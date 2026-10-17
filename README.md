# coffi-konsept

[Delta Cafés İngilizce sitesinin](https://deltacafes.com/en) Next.js ile hazırlanmış konsept uygulaması. Masaüstü ve mobil yerleşimler, özgün tipografi, videolar ve hareketli grafikler referans alınmıştır.

![Masaüstü önizleme](docs/home-desktop.png)

## Çalıştırma

Node.js 20.9 veya üzeri gerekir.

```bash
npm ci
npm run dev
```

Önizleme: [http://localhost:3000/en](http://localhost:3000/en)

```bash
npm run typecheck
npm run build
npm run start
```

Ortam değişkeni veya CMS bağlantısı gerekmez. Görseller, fontlar, videolar, Rive dosyaları, WASM ve Lottie kaynakları `public/` içinde tutulur.

## Kapsam

- Anasayfanın bütün bölümleri: video hero, ürün şeridi, history, coffee cycle, D de Delta, coffee culture, quiz, journal, sustainability ve footer.
- Masaüstü açılır menüler, mobil alt menüler, slider kontrolleri, sürüklenebilir şeritler ve mobil footer akordeonları.
- Lenis kaydırma, GSAP geçişleri, history fotoğraf/halat fiziği, quiz yörüngeleri ve görünürlüğe göre çalışan animasyonlar.
- 89 iç sayfa; 36 ürün detayı, journal içerikleri, coffee cycle, academy, history, sustainability ve yedi quiz sonuç profili.
- Ürün filtreleri, hazırlama galerileri, ürün arka plan animasyonları, interaktif grafikler ve journal kategori/sayfalama kontrolleri.
- Beş soruluk quiz ve referansın puan tablosuna göre sonuç eşleştirmesi.
- Yerel çerez tercihleri. Portekizce dil seçimi, mağaza, sosyal hesaplar ve kurum bağlantıları özgün dış adreslerine açılır.

## Teknolojiler

Next.js App Router · React · TypeScript · GSAP/ScrollTrigger · Lenis · Rive · Lottie · Chart.js

Sayfalar Next.js tarafından önceden oluşturulur. Referansın sunucuda üretilmiş bölüm yapısı ve kapsamlı CSS kuralları korunur; etkileşimler React istemci bileşenleri tarafından yönetilir. Uygulama özgün Nuxt JavaScript çalışma zamanını yüklemez.

## Dosya yapısı

```text
src/app/                         Next.js rotaları ve ortak stiller
src/components/                  Menü, anasayfa, detaylar ve kaydırma
src/components/sections/         Quiz, grafik, medya ve etkileşim modülleri
src/data/                       Yerel sayfa içerikleri ve medya eşleştirmeleri
public/                         Font, görsel, video, animasyon ve kapsamlı CSS
docs/                           Masaüstü ve mobil önizleme görselleri
scripts/                        Referans hazırlama yardımcıları
```

`scripts/` geliştirme sırasında kullanılan, Git'e eklenmeyen `reference/` yakalamalarıyla çalışır. Uygulamayı kurmak, çalıştırmak veya build almak için bu yardımcıları çalıştırmak gerekmez.

## Doğrulama

- TypeScript kontrolü ve production build başarılı.
- Anasayfa adresleri ve 89 iç sayfa: production sunucusunda 91/91 başarılı HTTP kontrolü.
- Masaüstü 1440×900 ve mobil 390×844 tarayıcı kontrolleri.
- Quiz başlangıçtan sonuca, mobil ürün filtresi, journal kategori/sayfalama, menüler ve ürün animasyonları kontrol edildi.
- Yerel medya manifestlerinde eksik dosya yok.

[Mobil önizleme](docs/home-mobile.png)

## Referans

Marka, metinler ve görsel/animasyon kaynakları **Delta Cafés**; özgün site tasarımı **Büro**. Bu repository bağımsız bir konsept uygulamasıdır.
