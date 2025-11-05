import { NextRequest, NextResponse } from "next/server";
import { loadEnvConfig } from "@next/env";
import stream from "stream";
import { promisify } from "util";
import fetch  from "node-fetch";
import { getICSCache, getLastUpdate } from "../../api/calendar/cache";

loadEnvConfig(process.cwd());

let calendarUrl = process.env.CALENDAR_URL || null;

interface CalendarEvent {
    title: string;
    start: string;
    end: string;
}

async function fetchCalendarData(): Promise<string> {
    const pipeline = promisify(stream.pipeline);
    if (!calendarUrl) {
        throw new Error('CALENDAR_URL environment variable is not set');
    }

    const response = await fetch(calendarUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
    }

    const readableStream = response.body;
    if (!readableStream) {
        throw new Error('Failed to create readable stream');
    }

    let calendarData = '';

    const writableStream = new stream.Writable({
        write(chunk, encoding, callback) {
            calendarData += chunk.toString();
            callback();
        }
    });
    
    await pipeline(readableStream, writableStream);
    return calendarData;
}

function parseCalendarEvents(calendarData: string): CalendarEvent[] {
    let lines = calendarData.split('\n');
    let events: CalendarEvent[] = [];
    
    let running: boolean = true;
    let line: number = 0;
    let readingEvent: boolean = false;
    let event: CalendarEvent = {
        title: '',
        start: '',
        end: '',
    };

    while (running) {
        if (lines[line].startsWith('BEGIN:VEVENT')) {
            readingEvent = true;
        }

        if (readingEvent) {
            event.title = "Flight Booked";
            if (lines[line].startsWith('DTSTART')) {
                event.start = lines[line].split(':')[1].replace('\r', '');
                if (event.start.split('T').length != 2) {
                    readingEvent = false;
                    line++;
                    continue;
                }
            }
            if (lines[line].startsWith('DTEND')) {
                event.end = lines[line].split(':')[1].replace('\r', '');
                if (event.end.split('T').length != 2) {
                    readingEvent = false;
                    line++;
                    continue;
                }
            }
            if (! readingEvent) {
                line++;
                continue;
            }
        }

        if (lines[line].startsWith('END:VEVENT')) {
            readingEvent = false;
            if (event.start === '' || event.end === '') {
                line++;
                continue;
            }
            events.push(event);
            event = {
                title: '',
                start: '',  
                end: '',
            };
        }

        line++;

        if (line >= lines.length) {
            running = false;
        }
    }

    return events;
}

function generateICS(events: CalendarEvent[]): string {
    let ics = 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//Calendar Cron Job//EN\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += 'METHOD:PUBLISH\r\n';
    
    events.forEach((event, index) => {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        ics += 'BEGIN:VEVENT\r\n';
        ics += `UID:${Date.now()}-${index}@calendar-cron-job\r\n`;
        ics += `DTSTART:${event.start}\r\n`;
        ics += `DTEND:${event.end}\r\n`;
        ics += `DTSTAMP:${timestamp}\r\n`;
        ics += `SUMMARY:${event.title}\r\n`;
        ics += 'STATUS:CONFIRMED\r\n';
        ics += 'TRANSP:OPAQUE\r\n';
        ics += 'X-MICROSOFT-CDO-BUSYSTATUS:OOF\r\n';
        ics += 'X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY\r\n';
        ics += `DESCRIPTION:${event.title}\r\n`;
        ics += 'END:VEVENT\r\n';
    });
    
    ics += 'END:VCALENDAR\r\n';
    return ics;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

export async function GET(request: NextRequest) {
    try {
        // Verificar se há cache válido (atualizado pelo cron job)
        const cachedICS = getICSCache();
        const lastUpdate = getLastUpdate();
        const now = Date.now();
        
        if (cachedICS && (now - lastUpdate) < CACHE_DURATION) {
            // Retornar cache existente (atualizado pelo cron job)
            return new Response(cachedICS, {
                headers: {
                    'Content-Type': 'text/calendar; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600',
                }
            });
        }

        // Se não há cache ou expirou, gerar novo conteúdo (fallback)
        // Nota: O ideal é que o cron job sempre atualize o cache antes
        const calendarData = await fetchCalendarData();
        const events = parseCalendarEvents(calendarData);
        const icsContent = generateICS(events);
        
        return new Response(icsContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            }
        });
    } catch (error) {
        console.error('Error generating calendar file:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            }
        });
    }
}

