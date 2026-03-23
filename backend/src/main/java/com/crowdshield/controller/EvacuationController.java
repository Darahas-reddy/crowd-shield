package com.crowdshield.controller;

import com.crowdshield.service.EvacuationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/evacuation")
@RequiredArgsConstructor
public class EvacuationController {

    private final EvacuationService evacuationService;

    @PostMapping("/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> activate(
            @RequestBody(required = false) Map<String, String> body) {
        String reason = (body != null)
                ? body.getOrDefault("reason", "Manual evacuation activated")
                : "Manual evacuation activated";
        return ResponseEntity.ok(evacuationService.activate(reason));
    }

    @PostMapping("/clear")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> clear() {
        return ResponseEntity.ok(evacuationService.clear());
    }
}
