package com.crowdshield.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "zone_history")
@CompoundIndex(name = "zone_time", def = "{'zoneId': 1, 'recordedAt': -1}")
public class ZoneHistory {

    @Id
    private String id;

    private String zoneId;
    private String zoneName;
    private int currentCount;
    private int capacity;
    private double densityPct;
    private Zone.ZoneStatus status;
    private LocalDateTime recordedAt;
}
