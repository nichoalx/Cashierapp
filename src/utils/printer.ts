const SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID    = "00002af1-0000-1000-8000-00805f9b34fb";

let printerChar: BluetoothRemoteGATTCharacteristic | null = null;

export interface PrintItem {
  productName: string;
  variantValue?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface PrintTransaction {
  timestamp: number;
  orderNumber: number;
  items: PrintItem[];
  totalAmount: number;
  discount?: number;
  remarks?: string;
}

export async function connectPrinter() {
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERVICE_UUID],
  });
  const server  = await device.gatt!.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  printerChar   = await service.getCharacteristic(CHAR_UUID);
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function sendToPrinter(data: Uint8Array) {
  const CHUNK = 20;
  for (let i = 0; i < data.length; i += CHUNK) {
    await printerChar!.writeValue(data.slice(i, i + CHUNK));
    await delay(100);
  }
  // let the printer drain its UART buffer before we resolve
  await delay(300);
}

export async function printReceipt(tx: PrintTransaction) {
  if (!printerChar) await connectPrinter();
  try {
    await sendToPrinter(new TextEncoder().encode(buildReceipt(tx)));
  } catch (e) {
    printerChar = null;
    throw e;
  }
}

function rp(n: number) {
  return `Rp.${n.toLocaleString("id-ID")}`;
}

function padLine(left: string, right: string, width = 32) {
  return left + " ".repeat(Math.max(1, width - left.length - right.length)) + right;
}

function fmtQty(q: number) {
  return q % 1 === 0 ? String(q) : q.toFixed(1);
}

function expandName(name: string): string {
  return name.replace(/\bTempe\b/gi, 'Bibit Tempe').replace(/\bDages\b/gi, 'Bibit Dages');
}

function buildReceipt(tx: PrintTransaction): string {
  const ESC = "\x1b";
  const INIT     = `${ESC}\x40`;
  const CENTER   = `${ESC}\x61\x01`;
  const LEFT     = `${ESC}\x61\x00`;
  const BOLD_ON  = `${ESC}\x45\x01`;
  const BOLD_OFF = `${ESC}\x45\x00`;
  const LINE     = "-".repeat(32);

  const d        = new Date(tx.timestamp);
  const date     = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  const orderNum = `#${String(tx.orderNumber).padStart(3,"0")}`;
  const discount = tx.discount ?? 0;
  const subtotal = tx.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const itemLines = tx.items.flatMap(i => {
    const name = `${expandName(i.productName)}${i.variantValue ? ` ${i.variantValue}` : ""}`;
    const qty  = `${fmtQty(i.quantity)}${i.unit} x ${rp(i.unitPrice)}`;
    const sub  = rp(i.quantity * i.unitPrice);
    return [`${name}\n`, `${padLine(qty, sub)}\n\n`];
  });

  const totalSection = discount > 0
    ? [
        `${LINE}\n`,
        `${padLine("Subtotal", rp(subtotal))}\n`,
        BOLD_ON, `${padLine("Diskon", `-${rp(discount)}`)}\n`, BOLD_OFF,
        `${padLine("TOTAL.", rp(tx.totalAmount))}\n`,
      ]
    : [
        `${LINE}\n`,
        BOLD_ON, `${padLine("TOTAL.", rp(tx.totalAmount))}\n`, BOLD_OFF,
      ];

  return [
    INIT,
    CENTER,
    BOLD_ON, "Agro Muda Anugerah\n", BOLD_OFF,
    "Jl. Gatot Subroto No. 712\n",
    "Randudongkal, Pemalang, 52353.\n",
    "+62 819-3067-7877\n",
    "\n",
    LEFT,
    `${padLine(date, orderNum)}\n`,
    `${LINE}\n`,
    ...itemLines,
    ...totalSection,
    tx.remarks ? `\n${tx.remarks}\n` : "",
    "\n",
    CENTER, "Terima Kasih!\n\n\n",
  ].join("");
}
