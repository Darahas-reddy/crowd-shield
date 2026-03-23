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
@Document(collection = "incidents")
public class Incident {

    @Id
    private String id;

    private String zoneId;
    private String zoneName;
    private String title;
    private String description;
    private IncidentType type;
    private Severity severity;
    private IncidentStatus status;
    private String reportedBy;
    private LocalDateTime reportedAt;
    private LocalDateTime resolvedAt;
    private String resolutionNotes;

    public enum IncidentType {
        OVERCROWDING, MEDICAL, FIRE, STAMPEDE, SECURITY, OTHER
    }

    public enum Severity {
        LOW, MEDIUM, HIGH, CRITICAL
    }

    public enum IncidentStatus {
        OPEN, IN_PROGRESS, RESOLVED, CLOSED
    }
}
