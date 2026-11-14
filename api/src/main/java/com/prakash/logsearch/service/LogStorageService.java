package com.prakash.logsearch.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.prakash.logsearch.client.IndexerClient;
import com.prakash.logsearch.models.LogFileInfo;

@Service
public class LogStorageService
{
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._-]{1,200}");

    private final Path dir;
    private final IndexerClient indexer;

    public LogStorageService(@Value("${losearch.storage-dir}") String storageDir, IndexerClient indexer) throws IOException
    {
        this.dir = Path.of(storageDir).toAbsolutePath().normalize();
        this.indexer = indexer;
        Files.createDirectories(dir);
    }

    public LogFileInfo save(MultipartFile file) throws IOException {
        if(file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST), "File is empty");
        }

        String original = file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename();
        String safeName = original.replaceAll("[^A-Za-z0-9._-]", "_").replaceAll("\\.log$", "");
        String id = UUID.randomUUID().toString().substring(0,8) + "-" + safeName;

        Path logFile = dir.resolve(id + ".log");
        file.transferTo(logFile);

        try {
            indexer.build(logFile, dir.resolve(id));
        } catch(RuntimeException e) {
            delete(id);
            throw e;
        }
        return new LogFileInfo(id, Files.size(logFile));
    }


    public List<LogFileInfo> list() throws IOException
    {
        try (Stream<Path> files = Files.list(dir)) {
            
            return files.filter(p -> p.getFileName().toString().endsWith(".log"))
                        .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                        .map(p -> { 
                            String name = p.getFileName().toString();

                            try {

                                return new LogFileInfo(name.substring(0, name.length() - 4), Files.size(p));
                            } catch(IOException e) {

                                return new LogFileInfo(name.substring(0, name.length()- 4), -1);
                            }
                        }).toList();
        }
    }


    publlic Path logPath(String id) {
        if(!SAFE_ID.matcher(id).matches() || id.contains.("..")) {

            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid log id");
        }

        Path path = dir.resolve(id + ".log")
        if (!Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such log: " + id);
        }

        return path;
    }

    public Path indexPrefix(String id) {return dir.resolve(id);}

    public void delete(String id) {

        logPath(id);
        for (String ext: List.of(".log", ".idx", ".off")) {
            try {
                Files.deleteIfExists(dir.resolve(id + ext));
            } catch(IOException ignored) {}
        }
    }
}
