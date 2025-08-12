package com.strukturedkaos.languatalkapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class AudioForegroundService extends Service {
    private static final String CHANNEL_ID = "AudioCallChannel";
    private static final int NOTIFICATION_ID = 1;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            // Handle null intent gracefully
            android.util.Log.w("AudioForegroundService", "Received null intent, stopping service");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        
        String action = intent.getAction();
        
        if ("START_AUDIO_SERVICE".equals(action)) {
            startForeground(NOTIFICATION_ID, createNotification());
        } else if ("STOP_AUDIO_SERVICE".equals(action)) {
            stopForeground(true);
            stopSelf();
        }
        
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                "Audio Call Service",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Maintains audio recording during voice calls");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            notificationIntent, 
            PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Voice Call Active")
            .setContentText("Langua is recording audio for your conversation")
            .setSmallIcon(R.drawable.notification_icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .build();
    }
} 
