package com.prakash.logsearch.service;


import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.prakash.logsearch.client.IndexerClient;
import com.prakash.logsearch.models.SearchResponse;
import com.prakash.logsearch.models.IndexerResult;
import com.prakash.logsearch.models.LogLine;


@Service
public class SearchService
{
        
    private static final Set<String> LEVEL = Set.of("TRACE", "DEBUG", "INFO", "WARN", "ERROR");
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final int FETCH_CAP = 100_000;

    private final LogStorageService storage;
    private final IndexerClient indexer;

    public SearchService(StorageService storage, IndexerClient indexer)
    {
        this.storage = storage;
        this.indexer = indexer;
    }

    public SearchResponse search(String id, String q, String level, LocalDateTime from, LocaDatetime to, int limit, String engine)
    {
        Path logFile = storage.logPath(id);

        List<String> terms = new ArrayList<>();

        if (q != null && !q.isBlank()) {
            terms.addAll(Arrays.asList(q.trim().split("\\s+")));
        }

        String levelUpper = null;
        if (level != null && !level.isBlank()) {
            levelUpper = level.trim().toUpperCase();
            if (!LEVELS.contains(levelUpper)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "level must be one of " + LEVELS);
            }
            terms.add(levelUpper.toLowerCase());  // narrows the search inside the index
        }
        if (terms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide q and/or level");
        }
        if (!engine.equals("cpp") && !engine.equals("java")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "engine must be cpp or java");
        }

        boolean needsPostFilter = levelUpper != null || from != null || to != null;
        int fetch = needsPostFilter ? FETCH_CAP : limit;

        long start = System.nanoTime();
        IndexerResult raw = engine.equals("cpp")
                ? indexer.search(logFile, storage.indexPrefix(id), fetch, terms)
                : scanInJava(logFile, terms, fetch);

        List<LogLine> filtered = raw.lines();
        long total = raw.total();
        if (needsPostFilter) {
            Pattern levelPattern = levelUpper == null ? null
                    : Pattern.compile("\\s" + levelUpper + "\\s", Pattern.CASE_INSENSITIVE);
            filtered = raw.lines().stream()
                    .filter(l -> levelPattern == null || levelPattern.matcher(l.text()).find())
                    .filter(l -> inRange(l.text(), from, to))
                    .toList();
            total = filtered.size();
        }
        List<LogLine> page = filtered.size() > limit ? filtered.subList(0, limit) : filtered;
        long tookMs = (System.nanoTime() - start) / 1_000_000;

        return new SearchResponse(engine, String.join(" ", terms), total, page.size(), tookMs, page);
    }

    private static boolean inRange(String line, LocalDateTime from, LocalDateTime to) {
        if (from == null && to == null) return true;
        LocalDateTime ts = parseTimestamp(line);
        if (ts == null) return false;
        return (from == null || !ts.isBefore(from)) && (to == null || !ts.isAfter(to));
    }

    private static LocalDateTime parseTimestamp(String line) {
        if (line.length() < 19) return null;
        try {
            return LocalDateTime.parse(line.substring(0, 19), TIMESTAMP);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static IndexerResult scanInJava(Path logFile, List<String> terms, int fetch) {
        Set<String> wanted = new HashSet<>();
        for (String term : terms) {
            wanted.addAll(tokenize(term));
        }
        List<LogLine> lines = new ArrayList<>();
        long total = 0;
        long lineNumber = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(Files.newInputStream(logFile), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (tokenize(line).containsAll(wanted)) {
                    total++;
                    if (lines.size() < fetch) {
                        lines.add(new LogLine(lineNumber, line));
                    }
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return new IndexerResult(total, lines);
    }

    private static Set<String> tokenize(String text) {
        Set<String> tokens = new HashSet<>();
        for (String t : text.toLowerCase().split("[^a-z0-9_]+")) {
            if (!t.isEmpty()) tokens.add(t);
        }
        return tokens;
    }
}
