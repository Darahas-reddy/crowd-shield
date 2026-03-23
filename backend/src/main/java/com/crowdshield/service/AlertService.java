package com.crowdshield.service;

import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.model.Alert;
import com.crowdshield.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository       alertRepository;
    private final AlertBroadcastService alertBroadcast;

    public List<Alert> getAllAlerts() {
        return alertRepository.findAll();
    }

    public List<Alert> getUnacknowledgedAlerts() {
        return alertRepository.findByAcknowledgedFalseOrderByCreatedAtDesc();
    }

    public long getUnacknowledgedCount() {
        return alertRepository.countByAcknowledgedFalse();
    }

    public Alert acknowledgeAlert(String id) {
        Alert a = alertRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Alert", id));
        a.setAcknowledged(true);
        a.setAcknowledgedAt(LocalDateTime.now());
        Alert saved = alertRepository.save(a);
        alertBroadcast.broadcast();
        return saved;
    }

    public void acknowledgeAll() {
        List<Alert> unacked = alertRepository.findByAcknowledgedFalse();
        LocalDateTime now = LocalDateTime.now();
        unacked.forEach(a -> { a.setAcknowledged(true); a.setAcknowledgedAt(now); });
        alertRepository.saveAll(unacked);
        alertBroadcast.broadcast();
    }

    public void deleteAlert(String id) {
        alertRepository.deleteById(id);
        alertBroadcast.broadcast();
    }
}
