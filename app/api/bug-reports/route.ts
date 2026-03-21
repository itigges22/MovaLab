import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'bug-reports.json');
const MAX_DESCRIPTION_LENGTH = 5000;

interface BugReport {
  id: string;
  description: string;
  category: string | null;
  severity: string | null;
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };
  user: { id: string; email: string; name: string } | null;
  consoleErrors: { message: string; timestamp: string }[];
  timestamp: string;
  status: 'open';
}

async function readReports(): Promise<BugReport[]> {
  try {
    const content = await fs.readFile(FILE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeReports(reports: BugReport[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(reports, null, 2), 'utf-8');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      !body.description ||
      typeof body.description !== 'string' ||
      body.description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    if (body.description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const report: BugReport = {
      id: crypto.randomUUID(),
      description: body.description.trim(),
      category: body.category || null,
      severity: body.severity || null,
      url: body.url || '',
      userAgent: body.userAgent || '',
      viewport: body.viewport || { width: 0, height: 0 },
      user: body.user || null,
      consoleErrors: Array.isArray(body.consoleErrors)
        ? body.consoleErrors.slice(0, 10)
        : [],
      timestamp: new Date().toISOString(),
      status: 'open',
    };

    const reports = await readReports();
    reports.push(report);
    await writeReports(reports);

    return NextResponse.json({ success: true, id: report.id }, { status: 201 });
  } catch (error) {
    console.error('Bug report submission failed:', error);
    return NextResponse.json(
      { error: 'Failed to save bug report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const reports = await readReports();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const filtered = status
      ? reports.filter((r) => r.status === status)
      : reports;

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Bug report fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to read bug reports' },
      { status: 500 }
    );
  }
}
