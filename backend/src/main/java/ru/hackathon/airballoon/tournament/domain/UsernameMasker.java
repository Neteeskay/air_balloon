package ru.hackathon.airballoon.tournament.domain;

public final class UsernameMasker {
    private UsernameMasker() {}

    public static String mask(String name) {
        if (name == null || name.isBlank() || name.codePointCount(0, name.length()) <= 3) return "***";
        return "***" + name.substring(name.offsetByCodePoints(0, 3));
    }
}
