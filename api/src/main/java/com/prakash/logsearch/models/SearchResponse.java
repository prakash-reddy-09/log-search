package com.prakash.logsearch.models;


import java.util.List;

public record SearchResponse(String engine, String query, long totalMatches, int returned, long tookMs, List<LogLine> results) {}
