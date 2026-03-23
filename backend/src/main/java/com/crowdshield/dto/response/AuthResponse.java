package com.crowdshield.dto.response;

public record AuthResponse(
    String token,
    String email,
    String fullName,
    String role,
    long   expiresInMs
) {}
