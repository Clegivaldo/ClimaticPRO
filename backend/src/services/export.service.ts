import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { prisma } from '../utils/prisma';

/**
 * Service for data export (CSV and PDF)
 * Requirement 8.1: CSV export
 * Requirement 8.2: PDF export
 * Requirement 8.7: Metadata inclusion
 */

export interface ExportOptions {
  sensorId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  parameters: string[];
}

/**
 * Generate CSV export for sensor data
 */
export async function generateCSV(options: ExportOptions) {
  const { sensorId, userId, startDate, endDate, parameters } = options;

  // Verify ownership and get sensor info
  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, userId }
  });

  if (!sensor) {
    throw new Error('Sensor not found or access denied');
  }

  const readings = await prisma.sensorReading.findMany({
    where: {
      sensorId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { timestamp: 'asc' }
  });

  // Metadata inclusion (Requirement 8.7)
  const metadata = [
    { label: 'Sensor', value: sensor.alias || sensor.mac },
    { label: 'Export Date', value: new Date().toISOString() },
    { label: 'Start Date', value: startDate.toISOString() },
    { label: 'End Date', value: endDate.toISOString() }
  ];

  const fields = ['timestamp', ...parameters];
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(readings);

  // Prepend metadata as comments
  const metadataStr = metadata.map(m => `# ${m.label}: ${m.value}`).join('\n');
  return `${metadataStr}\n\n${csv}`;
}

/**
 * Generate PDF export for sensor data
 */
export async function generatePDF(options: ExportOptions): Promise<Buffer> {
  const { sensorId, userId, startDate, endDate, parameters } = options;

  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, userId }
  });

  if (!sensor) {
    throw new Error('Sensor not found or access denied');
  }

  const readings = await prisma.sensorReading.findMany({
    where: {
      sensorId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { timestamp: 'asc' }
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title and Metadata (Requirement 8.7)
    doc.fontSize(20).text('Climatic Pro - Sensor Data Report', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).text(`Sensor: ${sensor.alias || sensor.mac}`);
    doc.text(`Type: ${sensor.deviceType}`);
    doc.text(`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    doc.text(`Generated at: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Table Header
    const tableTop = 200;
    const colWidth = 450 / (parameters.length + 1);
    
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Timestamp', 50, tableTop);
    parameters.forEach((param, i) => {
      doc.text(param.toUpperCase(), 150 + (i * colWidth), tableTop);
    });
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table Content
    let y = tableTop + 25;
    doc.font('Helvetica');
    
    readings.forEach((reading: any) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.text(new Date(reading.timestamp).toLocaleString(), 50, y);
      parameters.forEach((param, i) => {
        const val = reading[param];
        doc.text(val !== null ? val.toString() : '-', 150 + (i * colWidth), y);
      });
      
      y += 20;
    });

    doc.end();
  });
}
