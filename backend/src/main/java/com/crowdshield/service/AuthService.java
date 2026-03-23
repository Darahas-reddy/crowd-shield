package com.crowdshield.service;

import com.crowdshield.dto.request.LoginRequest;
import com.crowdshield.dto.request.RegisterRequest;
import com.crowdshield.dto.response.AuthResponse;
import com.crowdshield.exception.BadRequestException;
import com.crowdshield.model.User;
import com.crowdshield.repository.UserRepository;
import com.crowdshield.security.JwtUtil;
import com.crowdshield.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository         userRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JwtUtil                jwtUtil;
    private final AuthenticationManager  authManager;
    private final UserDetailsServiceImpl userDetailsServiceImpl;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email().toLowerCase()))
            throw new BadRequestException("Email already registered: " + req.email());

        User.Role role = "ADMIN".equalsIgnoreCase(req.role())
                ? User.Role.ROLE_ADMIN : User.Role.ROLE_USER;

        User user = User.builder()
                .fullName(req.fullName())
                .email(req.email().toLowerCase())
                .password(passwordEncoder.encode(req.password()))
                .role(role)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();
        userRepository.save(user);
        return buildToken(user);
    }

    public AuthResponse login(LoginRequest req) {
        // Throws BadCredentialsException on failure → caught by GlobalExceptionHandler → 401
        authManager.authenticate(
            new UsernamePasswordAuthenticationToken(req.email().toLowerCase(), req.password())
        );
        User user = userRepository.findByEmail(req.email().toLowerCase())
                .orElseThrow(() -> new BadRequestException("User not found"));
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
        return buildToken(user);
    }

    private AuthResponse buildToken(User user) {
        UserDetails ud = userDetailsServiceImpl.loadUserByUsername(user.getEmail());
        String token   = jwtUtil.generateToken(ud, Map.of(
                "role",     user.getRole().name(),
                "fullName", user.getFullName()
        ));
        return new AuthResponse(token, user.getEmail(), user.getFullName(),
                                user.getRole().name(), expirationMs);
    }
}
