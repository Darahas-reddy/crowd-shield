package com.crowdshield.repository;

import com.crowdshield.model.Alert;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AlertRepository extends MongoRepository<Alert, String> {
    List<Alert> findByAcknowledgedFalse();
    List<Alert> findByAcknowledgedFalseOrderByCreatedAtDesc();
    List<Alert> findByZoneId(String zoneId);
    long countByAcknowledgedFalse();
}
