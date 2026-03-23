package com.crowdshield.service;

import com.crowdshield.model.Alert;
import com.crowdshield.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Single-responsibility service: broadcast the current alert list over WebSocket.
 * ZoneService, IncidentService, and AlertService all depend on THIS —
 * breaking the previous circular dependency triangle.
 */
@Service
@RequiredArgsConstructor
public class AlertBroadcastService {

    private final AlertRepository      alertRepository;
    private final SimpMessagingTemplate messaging;

    public void broadcast() {
        List<Alert> unacked = alertRepository.findByAcknowledgedFalseOrderByCreatedAtDesc();
        Map<String, Object> payload = new HashMap<>();
        payload.put("alerts", unacked);
        payload.put("count",  unacked.size());
        messaging.convertAndSend("/topic/alerts", payload);
    }
}
