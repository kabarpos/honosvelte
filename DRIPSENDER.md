---

### 1. Integrasi API (Kirim Pesan Text + File)

Digunakan untuk mengirimkan pesan WhatsApp dari sistem/aplikasi Anda melalui API Dripsender.id.

* **HTTP Method:** `POST`
* **Endpoint URL:** `https://api.dripsender.id/send`
* **Format Request:** JSON Payload

#### Request Body (Parameters)
| Name | Type | Description |
| :--- | :--- | :--- |
| **media_url** | string | link attachment gambar, file, audio |
| **text** | string | isi pesan whatsapp |
| **phone** | string | gunakan nomor handphone didahului kode negara tanpa + contoh : 628135199xxxx<br><br>atau gunakan group id jika kirim ke group, dapatkan group id di menu "groups" dripsender |
| **group_id** | string | kosongkan jika bukan kirim ke group, dapatkan group_id melalui menu "groups" di dripsender |
| **api_key*** | string | dapatkan api_key di dashboard **dripsender.id** |


#### Response API

Jika request berhasil diterima dan diproses untuk dikirim, API akan mengembalikan status:

```text
200 Request diterima dan pesan dikirim.
OK

```

---

### 2. Webhook Dripsender

Webhook adalah mekanisme untuk menerima data atau pesan yang dikirim dari sistem Dripsender ke service/URL eksternal milik aplikasi Anda (ketika ada pesan masuk di WhatsApp). Pengaturan URL Webhook dapat dikonfigurasi melalui **Menu Bot** di Dripsender.

* **Format Pengiriman Data:** JSON `POST` request.

#### Contoh Payload JSON dari Dripsender ke Aplikasi Anda:

```json
{
  "phone": "6281351941xxx",
  "id": "3EB02155115CDB6024CF",
  "jid": "6281351941xxx@s.whatsapp.net",
  "text": "Sample Text",
  "name": "Abdullah",
  "timestamp": 1650957541
}

```

#### Format Response Webhook

Aplikasi Anda bebas mengembalikan response apa saja. Namun, jika Anda ingin sistem otomatis membalas pesan tersebut secara langsung, Anda wajib mengembalikan response dengan format JSON berikut:

```json
{
  "reply": true,
  "text": "Halo, ini balasannya."
}

```

---

### 3. Contoh Implementasi Kode (PHP natif / cURL)

Berikut adalah struktur dasar penulisan request API Dripsender menggunakan PHP dan cURL:

```php
<?php

$url = 'https://api.dripsender.id/send';
$phone = '62813xxxxxxxx'; // Ganti dengan nomor tujuan
$text = 'hello world';
$api_key = 'ganti-dengan-api-key-dripsender'; // Ganti dengan API Key Anda

// Inisialisasi cURL
$ch = curl_init($url);

// Menyusun JSON data
$jsonData = array(
    'api_key' => $api_key,
    'phone' => $phone,
    'text' => $text
);

// Mengubah array menjadi format JSON String
$jsonDataEncoded = json_encode($jsonData);

// Mengatur opsi cURL untuk POST request
curl_setopt($ch, CURLOPT_POST, 1);

// Memasukkan JSON payload ke dalam POST fields
curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonDataEncoded);

// Mengatur HTTP Header ke application/json
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

// Eksekusi request dan simpan hasilnya
$result = curl_exec($ch);

curl_close($ch);
?>

```