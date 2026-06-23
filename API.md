# Canlı Kurye Takip Sistemi - API & Socket.IO Dokümantasyonu

Bu belgede, projenin HTTP REST API endpointleri ile Socket.IO olayları (events) ve veri yapıları yer almaktadır.

---

## 1. HTTP REST API

Tüm API istekleri `/api` ön eki (prefix) ile sunulmaktadır.
İsteklerde `Content-Type: application/json` olmalıdır.

### 1.1. Kimlik Doğrulama (Authentication)

#### **Admin Girişi**
* **URL:** `/api/auth/login`
* **Metot:** `POST`
* **Yetki:** Herkese Açık
* **Rate Limit:** 15 dakikada en fazla 10 istek.
* **İstek Gövdesi (Request Body):**
  ```json
  {
    "email": "admin@kuryetakip.com",
    "password": "Admin123!"
  }
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "email": "admin@kuryetakip.com"
    }
  }
  ```
* **Hata Yanıtı (401 Unauthorized):**
  ```json
  {
    "success": false,
    "message": "Geçersiz e-posta veya şifre."
  }
  ```

#### **Admin Bilgisi Al**
* **URL:** `/api/auth/me`
* **Metot:** `GET`
* **Yetki:** Admin (Bearer JWT Token gereklidir. `Authorization: Bearer <token>`)
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "admin": {
      "id": 1,
      "email": "admin@kuryetakip.com",
      "created_at": "2026-06-23T16:00:00.000Z"
    }
  }
  ```

---

### 1.2. Kurye Yönetimi (Courier Management)

#### **Yeni Kurye Ekle**
* **URL:** `/api/couriers`
* **Metot:** `POST`
* **Yetki:** Admin (`Authorization` başlığı zorunlu)
* **İstek Gövdesi (Request Body):**
  ```json
  {
    "name": "Ahmet Yılmaz"
  }
  ```
* **Başarılı Yanıt (201 Created):**
  ```json
  {
    "success": true,
    "courier": {
      "id": 4,
      "name": "Ahmet Yılmaz",
      "unique_tracking_token": "a1b2c3d4e5f6g7h8i9j0",
      "status": "inactive",
      "created_at": "2026-06-23T16:03:00.000Z"
    }
  }
  ```

#### **Tüm Kuryeleri Listele (Canlı Konumlarıyla)**
* **URL:** `/api/couriers`
* **Metot:** `GET`
* **Yetki:** Admin (`Authorization` başlığı zorunlu)
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "couriers": [
      {
        "id": 1,
        "name": "Ahmet Yılmaz",
        "unique_tracking_token": "token_ahmet_123",
        "status": "active",
        "created_at": "2026-06-23T16:02:54.000Z",
        "latitude": 41.012345,
        "longitude": 28.976543,
        "accuracy": 12.5,
        "speed": 8.4,
        "heading": 180.0,
        "last_update": "2026-06-23T16:03:10.000Z"
      }
    ]
  }
  ```

#### **Kurye Sil**
* **URL:** `/api/couriers/:id`
* **Metot:** `DELETE`
* **Yetki:** Admin (`Authorization` başlığı zorunlu)
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "message": "Kurye başarıyla silindi.",
    "courier": {
      "id": 1,
      "name": "Ahmet Yılmaz"
    }
  }
  ```

#### **Token ile Kurye Doğrula (Takip Sayfası için)**
* **URL:** `/api/couriers/token/:token`
* **Metot:** `GET`
* **Yetki:** Herkese Açık (Kurye cihazı giriş yapar)
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "courier": {
      "id": 1,
      "name": "Ahmet Yılmaz",
      "unique_tracking_token": "token_ahmet_123",
      "status": "inactive"
    }
  }
  ```

---

### 1.3. Konum İşlemleri (Location Operations)

#### **HTTP Üzerinden Konum Kaydet (Socket.IO Fallback)**
* **URL:** `/api/locations`
* **Metot:** `POST`
* **Yetki:** Herkese Açık (Rate Limit: Dakikada en fazla 60 istek)
* **İstek Gövdesi (Request Body):**
  ```json
  {
    "courier_id": 1,
    "latitude": 41.012345,
    "longitude": 28.976543,
    "accuracy": 15.2,
    "speed": 5.4,
    "heading": 90,
    "timestamp": "2026-06-23T16:03:00.000Z"
  }
  ```

#### **Kurye Konum Geçmişi / Rota Bilgisi Al**
* **URL:** `/api/locations/:courierId/history?limit=100`
* **Metot:** `GET`
* **Yetki:** Admin (`Authorization` başlığı zorunlu)
* **Query Parametreleri:** `limit` (Varsayılan: 100, son X konumu getirir)
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "history": [
      {
        "id": 101,
        "latitude": 41.012300,
        "longitude": 28.976500,
        "accuracy": 15.0,
        "speed": 4.2,
        "heading": 85,
        "timestamp": "2026-06-23T16:01:00.000Z"
      },
      {
        "id": 102,
        "latitude": 41.012345,
        "longitude": 28.976543,
        "accuracy": 12.5,
        "speed": 5.4,
        "heading": 90,
        "timestamp": "2026-06-23T16:02:00.000Z"
      }
    ]
  }
  ```

---

## 2. Socket.IO Gerçek Zamanlı İletişim

Socket bağlantıları `http://localhost:5000` adresi üzerinden kurulur.

### 2.1. Handshake Bağlantısı ve Odalar (Rooms)

#### **Admin Bağlantısı**
Admin paneli bağlandığında query parametreleri veya auth nesnesi göndermelidir:
- `role: 'admin'`
- `token: 'JWT_ADMIN_TOKEN'`

Başarılı bağlantıda admin socket'i otomatik olarak `'admins'` odasına dahil edilir.

#### **Kurye Bağlantısı**
Kurye cihazı bağlandığında query parametreleri veya auth nesnesi göndermelidir:
- `role: 'courier'`
- `trackingToken: 'token_ahmet_123'`

Başarılı bağlantıda kurye socket'i otomatik olarak `courier_<courierId>` odasına dahil edilir. Veritabanındaki kurye durumu `active` olarak güncellenir ve adminlere durum değişikliği bildirilir.

---

### 2.2. Socket.IO Olayları (Events)

#### 1. `location_update` (Kurye -> Sunucu)
Kurye konum takibi yaparken aldığı verileri her 3 saniyede bir bu olayla gönderir.
* **Payload:**
  ```json
  {
    "latitude": 41.012345,
    "longitude": 28.976543,
    "accuracy": 8.5,
    "speed": 10.2,
    "heading": 210.5,
    "timestamp": 1782230600000
  }
  ```

#### 2. `courier_location_changed` (Sunucu -> Adminler)
Kuryeden yeni bir konum bilgisi geldiğinde, sunucu bunu veritabanına kaydeder ve ardından `'admins'` odasındaki tüm soketlere yayınlar (broadcast).
* **Payload:**
  ```json
  {
    "courierId": 1,
    "latitude": 41.012345,
    "longitude": 28.976543,
    "accuracy": 8.5,
    "speed": 10.2,
    "heading": 210.5,
    "last_update": "2026-06-23T16:03:00.000Z"
  }
  ```

#### 3. `courier_status_changed` (Sunucu -> Adminler)
Bir kurye bağlandığında (online/active) veya bağlantısı koptuğunda (offline/inactive), sunucu bu durumu veritabanında günceller ve adminlere yayınlar.
* **Payload:**
  ```json
  {
    "courierId": 1,
    "status": "active", // veya "inactive"
    "name": "Ahmet Yılmaz"
  }
  ```

#### 4. `error_message` (Sunucu -> Kurye/Admin)
Bağlantı veya veri işleme sırasında bir hata oluşursa gönderilir.
* **Payload:**
  ```json
  {
    "message": "Geçersiz konum formatı."
  }
  ```
