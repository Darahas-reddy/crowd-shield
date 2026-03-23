package com.crowdshield.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor // required by Spring Data MongoDB
@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String password; // BCrypt hash, never stored as plain text
    private String fullName;
    private Role role;
    private boolean active = true; // plain default, no @Builder.Default needed

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime lastLoginAt;

    // Manual builder to avoid Lombok @Builder.Default + @AllArgsConstructor conflict
    public static UserBuilder builder() {
        return new UserBuilder();
    }

    public static class UserBuilder {
        private String email;
        private String password;
        private String fullName;
        private Role role;
        private boolean active = true;
        private LocalDateTime createdAt;

        public UserBuilder email(String v) {
            this.email = v;
            return this;
        }

        public UserBuilder password(String v) {
            this.password = v;
            return this;
        }

        public UserBuilder fullName(String v) {
            this.fullName = v;
            return this;
        }

        public UserBuilder role(Role v) {
            this.role = v;
            return this;
        }

        public UserBuilder active(boolean v) {
            this.active = v;
            return this;
        }

        public UserBuilder createdAt(LocalDateTime v) {
            this.createdAt = v;
            return this;
        }

        public User build() {
            User u = new User();
            u.email = this.email;
            u.password = this.password;
            u.fullName = this.fullName;
            u.role = this.role;
            u.active = this.active;
            u.createdAt = this.createdAt;
            return u;
        }
    }

    public enum Role {
        ROLE_ADMIN,
        ROLE_USER
    }
}
