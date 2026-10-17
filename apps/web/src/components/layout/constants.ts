import type { CannedItem, CommandItem } from '../chat'

export const DEFAULT_CANNED_RESPONSES: CannedItem[] = [
  {
    id: 'canned-halo',
    shortCode: 'halo',
    content:
      'Halo kak! Selamat datang di layanan pelanggan kami. Ada yang bisa kami bantu hari ini?',
    title: 'Salam Pembuka',
  },
  {
    id: 'canned-ongkir',
    shortCode: 'ongkir',
    content:
      'Untuk pengecekan estimasi ongkos kirim, mohon informasikan alamat kecamatan dan kota tujuan ya kak.',
    title: 'Estimasi Ongkir',
  },
  {
    id: 'canned-terimakasih',
    shortCode: 'terimakasih',
    content: 'Terima kasih banyak telah menghubungi kami kak! Semoga harimu menyenangkan.',
    title: 'Ucapan Terima Kasih',
  },
  {
    id: 'canned-jamkerja',
    shortCode: 'jamkerja',
    content: 'Jam operasional layanan kami adalah Senin - Jumat pukul 08.00 - 17.00 WIB.',
    title: 'Jam Operasional',
  },
]

export const DEFAULT_SLASH_COMMANDS: CommandItem[] = [
  {
    id: 'cmd-cekresi',
    name: 'cekresi',
    description: 'Lacak status pengiriman kurir ekspedisi secara real-time',
    endpointUrl: 'https://api.external.com/courier/track',
  },
  {
    id: 'cmd-statusorder',
    name: 'statusorder',
    description: 'Periksa status pemesanan pelanggan di sistem e-commerce',
    endpointUrl: 'https://api.external.com/orders/status',
  },
  {
    id: 'cmd-refund',
    name: 'refund',
    description: 'Proses pengajuan klaim pengembalian dana tiket pelanggan',
    endpointUrl: 'https://api.external.com/orders/refund',
  },
]
