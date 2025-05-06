```mermaid
    graph TD
    Client[Client] --> API[API Gateway]
    API --> SR[Service Registry]
    
    
    Notifications --> RMQ[RabbitMQ]
 
    
    Norification --> SR
 
    
    RMQ --> Norification

    
    subgraph "Service Registration"
        SR -->|Heartbeat| SR
    end
    
    subgraph "Service Discovery"
        API -->|Query| SR
        API -->|Cache| API
    end
    
    subgraph "Event Communication"
        Auth -->|Publish| RMQ
        RMQ -->|Consume| Payments
    end
    ```