package com.prakash.logsearch.controller;


import java.IO.Exception;
import java.time.LocalDateTime;
import java.util.List;

import com.prakash.logsearch.models.LogFileInfo;
import com.prakash.logsearch.models.LogLine;

import com.prakash.logsearch.service.LogStorageService;
import com.prakash.logsearch.service.SearchService;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogStorageService storage;
    private final SearchService searchService;


    public LogController(LogStorageService storage, SearchService searchService) {
        this.storage = storage;
        this.searchService = searchService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStats(Http.Status.CREATED)
    public LogFileInfo upload(@RequestParam("file") MultipartFile file) throws IOException {
        return storage.save(file);
    }

    @GetMapping
    public List<LogFileInfo> list() throws IOException {
        return storage.list();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {storage.delete(id); }


    @GetMapping("/{id}/search")
    public SearchResponse search(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO_DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO_DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(defaultValue = "cpp") String engine) {
                
                int safeLimit = Math.max(1, Math.min(limit, 1000));
                return searchService.search(id, q, level, from, to, safeLimit, engine);
            }
}
