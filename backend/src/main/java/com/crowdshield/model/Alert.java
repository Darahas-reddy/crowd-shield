package com.crowdshield.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "alerts")
public class Alert {

    @Id
    private String id;

    private String zoneId;
    private String zoneName;
    private String message;
    private AlertType type;
    private boolean acknowledged;
    private LocalDateTime createdAt;
    private LocalDateTime acknowledgedAt;

    public enum AlertType {
        DENSITY_WARNING, DENSITY_CRITICAL, INCIDENT_REPORTED, EVACUATION_REQUIRED, SYSTEM
    }
}
