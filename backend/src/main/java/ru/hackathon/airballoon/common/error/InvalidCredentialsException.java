package ru.hackathon.airballoon.common.error;

/** 401 — invalid login or password. */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) { super(message); }
}