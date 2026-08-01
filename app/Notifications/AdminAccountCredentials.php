<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminAccountCredentials extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $username,
        private readonly string $initialPassword,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Akun Admin Ragil Aluminium')
            ->greeting('Halo, '.$notifiable->name)
            ->line('Akun panel admin Ragil Aluminium telah dibuat.')
            ->line('Username: '.$this->username)
            ->line('Password awal: '.$this->initialPassword)
            ->action('Masuk ke panel admin', route('login'))
            ->line('Segera ganti password melalui menu Profil Saya setelah berhasil masuk.');
    }
}