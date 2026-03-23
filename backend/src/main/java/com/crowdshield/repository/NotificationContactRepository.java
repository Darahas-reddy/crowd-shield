package com.crowdshield.repository;

import com.crowdshield.model.NotificationContact;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface NotificationContactRepository extends MongoRepository<NotificationContact, String> {
    List<NotificationContact> findByActiveTrue();
}
