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
@Document(collection = "tracked_users")
public class TrackedUser {

    @Id
    private String id;

    private String deviceId;       // unique ID per phone/browser
    private String displayName;    // optional name
    private double latitude;
    private double longitude;
    private double accuracy;       // GPS accuracy in metres
    private String currentZoneId;  // which zone they're currently in (null if none)
    private String currentZoneName;
    private LocalDateTime lastSeen;
    private boolean active;        // false = timed out (no ping in 30s)
}
