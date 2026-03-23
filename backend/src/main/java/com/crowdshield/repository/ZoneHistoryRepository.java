package com.crowdshield.repository;

import com.crowdshield.model.ZoneHistory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ZoneHistoryRepository extends MongoRepository<ZoneHistory, String> {
    List<ZoneHistory> findByZoneIdAndRecordedAtAfterOrderByRecordedAtAsc(String zoneId, LocalDateTime since);
    List<ZoneHistory> findByRecordedAtAfterOrderByRecordedAtAsc(LocalDateTime since);
    void deleteByRecordedAtBefore(LocalDateTime cutoff);
    long countByZoneId(String zoneId);
}
