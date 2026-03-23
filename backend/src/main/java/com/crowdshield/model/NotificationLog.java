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
@Document(collection = "notification_logs")
public class NotificationLog {

    @Id
    private String id;

    private String contactId;
    private String contactName;
    private String phone;

    private String channel;     // "SMS" or "WHATSAPP"
    private String alertType;
    private String zoneName;
    private String message;

    private String status;      // "SENT", "FAILED"
    private String twilioSid;   // Twilio message SID for tracking
    private String errorMessage;

    private LocalDateTime sentAt;
}
