import { ActionItem, ParseResult } from './types';

/**
 * Parse a meeting transcript into structured action items.
 * Uses pattern-matching heuristics to identify:
 * - Action items (keywords: "action", "todo", "task", "will", "should", "need to", "must")
 * - Assignees ("@name", "Name will...", "assigned to Name")
 * - Priority signals ("urgent", "critical", "asap", "important", "nice to have")
 * - Deadline signals ("by Friday", "before EOD", "next week", "by [date]")
 */
export function parseTranscript(transcript: string): ParseResult {
  const lines = transcript.split('\n').map(l => l.trim()).filter(Boolean);
  const actionItems: ActionItem[] = [];

  const actionPatterns = [
    /(?:action\s*(?:item)?\s*[:;-]?)\s*(.+)/i,
    /(?:todo\s*[:;-]?)\s*(.+)/i,
    /(?:task\s*[:;-]?)\s*(.+)/i,
    /(\S+)\s+(?:will|should|needs? to|must|has to|is going to)\s+(.+)/i,
    /(?:\[\s*(?:action|todo|task)\s*\])\s*(.+)/i,
    /(?:assigned\s+to\s+)(\S+)\s*[:;-]?\s*(.+)/i,
    /^[-*]\s+(.+(?:will|should|needs? to|must).+)/i,
  ];

  const priorityMap: Array<{ pattern: RegExp; level: ActionItem['priority'] }> = [
    { pattern: /\b(?:urgent|critical|asap|blocker|p0|high\s*priority)\b/i, level: 'high' },
    { pattern: /\b(?:important|significant|p1|medium\s*priority)\b/i, level: 'medium' },
    { pattern: /\b(?:nice\s*to\s*have|low\s*priority|p2|when\s*possible|eventually)\b/i, level: 'low' },
  ];

  const assigneePattern = /@(\w+)|(?:assigned\s+to\s+)(\w+)|^(\w+)\s+(?:will|should|needs? to)/i;

  const deadlinePatterns = [
    /by\s+(\w+day)/i,
    /before\s+(EOD|end\s+of\s+day|end\s+of\s+week|EOW)/i,
    /(?:by|before|due|deadline)\s+([A-Z][a-z]+ \d{1,2}(?:,?\s*\d{4})?)/i,
    /next\s+(week|month|sprint)/i,
  ];

  for (const line of lines) {
    for (const pattern of actionPatterns) {
      const match = line.match(pattern);
      if (match) {
        const rawText = match[match.length - 1] || match[1] || line;

        // Extract assignee
        const assigneeMatch = line.match(assigneePattern);
        const assignee = assigneeMatch
          ? (assigneeMatch[1] || assigneeMatch[2] || assigneeMatch[3] || null)
          : null;

        // Extract priority
        let priority: ActionItem['priority'] = 'medium';
        for (const { pattern: pPattern, level } of priorityMap) {
          if (pPattern.test(line)) {
            priority = level;
            break;
          }
        }

        // Extract deadline
        let deadline: string | null = null;
        for (const dPattern of deadlinePatterns) {
          const dMatch = line.match(dPattern);
          if (dMatch) {
            deadline = dMatch[1];
            break;
          }
        }

        // Avoid duplicate detection
        const isDuplicate = actionItems.some(
          item => item.title.toLowerCase() === rawText.toLowerCase().trim()
        );

        if (!isDuplicate && rawText.trim().length > 5) {
          actionItems.push({
            title: rawText.trim().slice(0, 200),
            assignee,
            priority,
            deadline,
            description: line.trim(),
          });
        }

        break; // Only match first pattern per line
      }
    }
  }

  // Generate summary
  const summary = generateSummary(lines, actionItems);

  return {
    actionItems,
    summary,
    parsedAt: new Date().toISOString(),
  };
}

function generateSummary(lines: string[], actionItems: ActionItem[]): string {
  const totalLines = lines.length;
  const itemCount = actionItems.length;
  const highPriority = actionItems.filter(i => i.priority === 'high').length;
  const assignees = [...new Set(actionItems.map(i => i.assignee).filter(Boolean))];

  let summary = `Parsed ${totalLines} lines of meeting notes. Found ${itemCount} action item${itemCount !== 1 ? 's' : ''}.`;

  if (highPriority > 0) {
    summary += ` ${highPriority} marked as high priority.`;
  }

  if (assignees.length > 0) {
    summary += ` Assignees: ${assignees.join(', ')}.`;
  }

  return summary;
}

/**
 * Format action items for Linear API consumption.
 */
export function formatForLinear(items: ActionItem[]): object {
  return {
    issues: items.map(item => ({
      title: item.title,
      description: item.description,
      priority: item.priority === 'high' ? 1 : item.priority === 'medium' ? 3 : 4,
      assigneeId: item.assignee || null,
    })),
  };
}

/**
 * Format action items for Jira API consumption.
 */
export function formatForJira(items: ActionItem[]): object {
  return {
    issues: items.map(item => ({
      summary: item.title,
      description: item.description,
      priority: { name: item.priority === 'high' ? 'High' : item.priority === 'medium' ? 'Medium' : 'Low' },
      assignee: item.assignee ? { name: item.assignee } : null,
    })),
  };
}
