package com.crowdshield.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import com.mongodb.client.model.IndexOptions;

import java.util.concurrent.TimeUnit;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class MongoIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void createIndexes() {

        // ── users ──────────────────────────────────────────────────────────
        IndexOperations users = mongoTemplate.indexOps("users");
        users.ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
        users.ensureIndex(new Index().on("role",  Sort.Direction.ASC));

        // ── zones ──────────────────────────────────────────────────────────
        IndexOperations zones = mongoTemplate.indexOps("zones");
        zones.ensureIndex(new Index().on("status",      Sort.Direction.ASC));
        zones.ensureIndex(new Index().on("lastUpdated", Sort.Direction.DESC));
        mongoTemplate.getCollection("zones")
            .createIndex(new Document("latitude", 1).append("longitude", 1));

        // ── alerts ─────────────────────────────────────────────────────────
        IndexOperations alerts = mongoTemplate.indexOps("alerts");
        alerts.ensureIndex(new Index().on("acknowledged", Sort.Direction.ASC));
        alerts.ensureIndex(new Index().on("createdAt",    Sort.Direction.DESC));
        alerts.ensureIndex(new Index().on("zoneId",       Sort.Direction.ASC));
        mongoTemplate.getCollection("alerts")
            .createIndex(new Document("acknowledged", 1).append("createdAt", -1));

        // ── incidents ──────────────────────────────────────────────────────
        IndexOperations incidents = mongoTemplate.indexOps("incidents");
        incidents.ensureIndex(new Index().on("status",     Sort.Direction.ASC));
        incidents.ensureIndex(new Index().on("zoneId",     Sort.Direction.ASC));
        incidents.ensureIndex(new Index().on("severity",   Sort.Direction.ASC));
        incidents.ensureIndex(new Index().on("reportedAt", Sort.Direction.DESC));

        // ── tracked_users ──────────────────────────────────────────────────
        IndexOperations tracked = mongoTemplate.indexOps("tracked_users");
        tracked.ensureIndex(new Index().on("deviceId",      Sort.Direction.ASC).unique());
        tracked.ensureIndex(new Index().on("active",        Sort.Direction.ASC));
        tracked.ensureIndex(new Index().on("currentZoneId", Sort.Direction.ASC));
        tracked.ensureIndex(new Index().on("lastSeen",      Sort.Direction.DESC));
        // TTL: auto-delete inactive GPS users after 24 hours
        mongoTemplate.getCollection("tracked_users")
            .createIndex(
                new Document("lastSeen", 1),
                new IndexOptions().expireAfter(86400L, TimeUnit.SECONDS)
            );

        log.info("MongoDB indexes ensured ✓");
    }
}
