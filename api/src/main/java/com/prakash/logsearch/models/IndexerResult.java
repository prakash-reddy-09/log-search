package com.prakash.logsearch.models;


import java.util.List;

public record IndexerResult(long total, List<LogLine> lines) {}
