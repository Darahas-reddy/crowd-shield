package com.crowdshield.repository;

import com.crowdshield.model.TrackedUser;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TrackedUserRepository extends MongoRepository<TrackedUser, String> {
    Optional<TrackedUser> findByDeviceId(String deviceId);
    List<TrackedUser> findByActiveTrue();
    List<TrackedUser> findByCurrentZoneId(String zoneId);
    List<TrackedUser> findByLastSeenBefore(LocalDateTime cutoff);
    long countByCurrentZoneIdAndActiveTrue(String zoneId);
}
