package com.crowdshield.repository;

import com.crowdshield.model.NotificationLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface NotificationLogRepository extends MongoRepository<NotificationLog, String> {
    List<NotificationLog> findTop50ByOrderBySentAtDesc();
    long countByStatus(String status);
}
