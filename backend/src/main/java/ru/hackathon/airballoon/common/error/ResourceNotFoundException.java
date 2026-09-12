package ru.hackathon.airballoon.common.error;

/** 404 — the requested resource does not exist. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) { super(message); }
}