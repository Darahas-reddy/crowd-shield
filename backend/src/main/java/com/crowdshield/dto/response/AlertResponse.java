package com.crowdshield.dto.response;

import com.crowdshield.model.Alert;

import java.time.LocalDateTime;

public record AlertResponse(
    String           id,
    String           zoneId,
    String           zoneName,
    String           message,
    Alert.AlertType  type,
    boolean          acknowledged,
    LocalDateTime    createdAt,
    LocalDateTime    acknowledgedAt
) {
    public static AlertResponse from(Alert a) {
        return new AlertResponse(
            a.getId(), a.getZoneId(), a.getZoneName(),
            a.getMessage(), a.getType(), a.isAcknowledged(),
            a.getCreatedAt(), a.getAcknowledgedAt()
        );
    }
}
