# Canlı Kurye Takip Sistemi (Live Courier Tracking System)

Bu proje; yöneticilerin (admin) kuryeleri harita üzerinde canlı olarak izleyebildiği, kuryelerin ise kendilerine özel benzersiz bir takip linki üzerinden GPS konumlarını gerçek zamanlı olarak paylaştığı profesyonel seviyede, production-ready bir kurye takip sistemidir.

---

## Proje Özellikleri

1. **Canlı Harita Takibi (Admin):** Google Maps JavaScript API entegrasyonu ile tüm kuryeler haritada anlık olarak gösterilir. Kuryelerin marker'ları, socket güncellemeleriyle akıcı bir şekilde hareket eder.
2. **Rota Çizimi (Polyline):** Seçilen kuryenin son 50 konum güncellemesinden oluşan rota çizgisi haritada çizilir.
3. **Konum Hassasiyet Çemberi:** Kuryelerin GPS doğruluk payı (accuracy) harita üzerinde yarıçap çemberi olarak görselleştirilir.
4. **Çevrimdışı Alarmları:** Bağlantısı kopan kuryeler admin panelinde kırmızı uyarı simgesiyle gösterilir.
5. **Konum Akış Kontrolü:** Kuryeler kendilerine özel link üzerinden tek tıkla konum takibini başlatıp durdurabilirler.
6. **Hassas Konum Yönetimi:** `enableHighAccuracy: true` ayarı ile tarayıcının ve cihazın desteklediği en yüksek GPS doğruluğu kullanılır.
7. **Düşük GPS Sinyal Uyarısı:** Kurye cihazında sinyal zayıfladığında (sapma > 30 metre) kullanıcı uyarılır.
8. **Güvenlik & Performans:** JWT tabanlı kimlik doğrulama, rate limiting, SQL injection ve XSS korumaları mevcuttur.

---

## Teknoloji Yığını (Tech Stack)

* **Frontend:** React, TypeScript, Tailwind CSS, Vite, Axios, Socket.io-client, Lucide-React
* **Backend:** Node.js, Express, TypeScript, Socket.IO, pg (PostgreSQL), Winston, JWT, Helmet
* **Veritabanı:** PostgreSQL
* **Konteynerleştirme:** Docker, Docker Compose

---

## Gereksinimler

Projenin yerel ortamda çalıştırılması için aşağıdaki bileşenlerin yüklü olması gerekir:
* **Node.js** (v18+) ve **npm** (v9+)
* **PostgreSQL** (Yerel ortamda çalıştırmak için)
* **Google Maps API Key** (Canlı Harita ekranı için zorunludur)

---

## 1. YEREL ORTAMDA KURULUM VE ÇALIŞTIRMA (DOCKER OLMADAN)

### 1.1. Veritabanı Kurulumu
1. PostgreSQL sunucunuzda `kuryetakip` adında bir veritabanı oluşturun.
2. `backend/src/db/schema.sql` dosyasındaki SQL sorgularını çalıştırarak tabloları ve indeksleri oluşturun.
3. `backend/src/db/seed.sql` dosyasındaki seed verisini çalıştırarak varsayılan admin kullanıcısını ve örnek kuryeleri ekleyin.

### 1.2. Backend Yapılandırması ve Başlatılması
1. `backend/` dizinine gidin.
2. `.env.example` dosyasını `.env` olarak kopyalayın.
3. `.env` dosyası içerisindeki `DATABASE_URL` ve `JWT_SECRET` değerlerini kendi ayarlarınıza göre düzenleyin.
4. Gerekli paketleri kurun ve backend'i başlatın:
   ```bash
   cd backend
   npm install
   # Geliştirici modunda çalıştırmak için:
   npm run dev
   ```
   *Not: Seed verilerini doğrudan komutla eklemek isterseniz `npm run seed` komutunu çalıştırabilirsiniz.*

### 1.3. Frontend Yapılandırması ve Başlatılması
1. `frontend/` dizinine gidin.
2. `.env.example` dosyasını `.env` olarak kopyalayın.
3. `.env` içerisindeki `VITE_GOOGLE_MAPS_API_KEY` alanına kendi **Google Maps API Key** anahtarınızı ekleyin.
4. Gerekli paketleri kurun ve frontend'i başlatın:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Uygulama tarayıcınızda otomatik olarak `http://localhost:5173` adresinde açılacaktır.

---

## 2. DOCKER COMPOSE İLE DEPLOYMENT

Docker Compose, veritabanını (PostgreSQL), backend servisini ve frontend servisini (Nginx) tek bir komutla ayağa kaldırır.

1. Projenin kök (root) dizininde yer alan `.env` dosyasını açın.
2. `VITE_GOOGLE_MAPS_API_KEY` alanına geçerli API anahtarınızı ekleyin.
3. Proje ana dizinindeyken aşağıdaki komutu çalıştırarak konteynerleri oluşturun ve başlatın:
   ```bash
   docker-compose up --build
   ```
4. Uygulama başlatıldıktan sonra:
   * **Admin Paneli & Arayüz:** `http://localhost:8080`
   * **API Gateway & Socket Server:** `http://localhost:5000`
   * **PostgreSQL Veritabanı:** `localhost:5432` portundan dışarıya açılır.

---

## Kullanım Kılavuzu & Giriş Bilgileri

### 1. Yönetici Girişi
* **Giriş URL'i:** `http://localhost:5173/login` (Docker için: `http://localhost:8080/login`)
* **Varsayılan E-posta:** `admin@kuryetakip.com`
* **Varsayılan Şifre:** `Admin123!`

### 2. Yeni Kurye Takibi Başlatma
1. Admin panelinde oturum açtıktan sonra sol üst kısımdan yeni bir kurye adı girip ekleyin.
2. Oluşturulan kuryenin yanındaki **Paylaşım Simgesine (Telefon)** tıklayarak benzersiz takip linkini kopyalayın.
3. Bu linki kuryeye ulaştırın (Örn: `http://localhost:5173/track/<token>`).
4. Kurye linke mobil cihazından girdikten sonra **"Konum Paylaşımını Başlat"** butonuna basarak tarayıcı konum iznini onaylar.
5. Konum paylaşımı başladığı andan itibaren admin panelindeki haritada kuryenin konumu mavi renkte, yönü ve hızıyla birlikte gerçek zamanlı güncellenir.
6. Kurye sayfayı kapattığında veya paylaşımı durdurduğunda admin panelinde kurye durumu anında **Kırmızı (Çevrimdışı)** renge döner.

---

## Güvenlik ve Production Notları

> [!WARNING]
> Tarayıcıların Geolocation API (`navigator.geolocation`) politikaları gereği, localhost haricindeki canlı sunucu ortamlarında konum servislerinin çalışabilmesi için uygulamanın **HTTPS** protokolü üzerinden sunulması yasal olarak zorunludur.

1. **JWT Güvenliği:** Production ortamına geçerken root ve backend dizinindeki `.env` dosyalarında yer alan `JWT_SECRET` değerini çok güçlü, rastgele bir karakter dizisiyle değiştirin.
2. **Rate Limiting:** Brute-force saldırılarını önlemek için `/api/auth/login` endpoint'ine IP bazlı rate limit uygulanmıştır. İhtiyaç durumunda `backend/src/middleware/rateLimiter.ts` dosyasından bu sınırlar esnetilebilir.
3. **Docker Data Persistence:** PostgreSQL verileri kaybolmaması için Docker Compose içerisinde `postgres_data` adında bir hacim (volume) tanımlanmıştır. Konteynerler silinse dahi verileriniz korunur.
