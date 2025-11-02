// push-manager.js - Управление Push уведомлениями
class PushNotificationManager {
    constructor() {
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        this.subscription = null;
        this.init();
    }

    async init() {
        if (!this.isSupported) {
            console.log('❌ Push уведомления не поддерживаются');
            return;
        }

        try {
            // Регистрируем Service Worker
            this.registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker зарегистрирован');

            // Проверяем текущую подписку
            this.subscription = await this.registration.pushManager.getSubscription();
            
            if (this.subscription) {
                console.log('✅ Push подписка уже активна');
            } else {
                console.log('❌ Push подписка не активна');
            }

        } catch (error) {
            console.error('❌ Ошибка инициализации Push менеджера:', error);
        }
    }

    async subscribeToPush() {
        if (!this.isSupported) {
            throw new Error('Push уведомления не поддерживаются');
        }

        try {
            // Запрашиваем разрешение
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                throw new Error('Разрешение на уведомления не получено');
            }

            // Подписываем на push уведомления
            this.subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array('BEl62iUYgUivzhIh8B46w5X6kAR2HjZ7X2p2bVgK7zQ')
            });

            console.log('✅ Push подписка создана');
            return this.subscription;

        } catch (error) {
            console.error('❌ Ошибка подписки на push:', error);
            throw error;
        }
    }

    async unsubscribeFromPush() {
        if (!this.subscription) {
            console.log('⚠️ Нет активной подписки для отмены');
            return;
        }

        try {
            await this.subscription.unsubscribe();
            this.subscription = null;
            console.log('✅ Push подписка отменена');
        } catch (error) {
            console.error('❌ Ошибка отмены подписки:', error);
            throw error;
        }
    }

    async sendTestNotification() {
        if (!this.subscription) {
            throw new Error('Нет активной push подписки');
        }

        try {
            // Отправляем тестовое уведомление через наш сервер
            const response = await fetch('/api/push/send-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: this.subscription,
                    title: 'Тестовое уведомление',
                    body: 'Это тестовое push уведомление от Спокойного рассвета!',
                    icon: '/images/logo.png'
                })
            });

            if (response.ok) {
                console.log('✅ Тестовое уведомление отправлено');
            } else {
                throw new Error('Ошибка отправки уведомления');
            }
        } catch (error) {
            console.error('❌ Ошибка отправки тестового уведомления:', error);
            throw error;
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Получить информацию о подписке
    getSubscriptionInfo() {
        if (!this.subscription) {
            return null;
        }

        const key = this.subscription.getKey('p256dh');
        const auth = this.subscription.getKey('auth');
        
        return {
            endpoint: this.subscription.endpoint,
            keys: {
                p256dh: key ? btoa(String.fromCharCode.apply(null, new Uint8Array(key))) : null,
                auth: auth ? btoa(String.fromCharCode.apply(null, new Uint8Array(auth))) : null
            }
        };
    }

    // Проверить статус подписки
    async checkSubscriptionStatus() {
        if (!this.isSupported) {
            return { supported: false, subscribed: false };
        }

        const subscription = await this.registration.pushManager.getSubscription();
        return {
            supported: true,
            subscribed: !!subscription,
            permission: Notification.permission
        };
    }
}

// Создаем глобальный экземпляр
window.pushManager = new PushNotificationManager();

// Функции для использования в настройках
window.PushManagerUtils = {
    // Включить push уведомления
    async enablePushNotifications() {
        try {
            const subscription = await window.pushManager.subscribeToPush();
            
            // Сохраняем подписку на сервере
            await fetch('/api/user/push-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    subscription: window.pushManager.getSubscriptionInfo(),
                    user_id: JSON.parse(localStorage.getItem('user_data')).id
                })
            });

            return { success: true, subscription };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Отключить push уведомления
    async disablePushNotifications() {
        try {
            await window.pushManager.unsubscribeFromPush();
            
            // Удаляем подписку с сервера
            await fetch('/api/user/push-subscription', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    user_id: JSON.parse(localStorage.getItem('user_data')).id
                })
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Отправить тестовое уведомление
    async sendTestPush() {
        try {
            await window.pushManager.sendTestNotification();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Получить статус
    async getPushStatus() {
        return await window.pushManager.checkSubscriptionStatus();
    }
};
