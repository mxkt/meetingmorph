import { describe, it, expect } from 'vitest';
import { parseTranscript, formatForLinear, formatForJira } from '../lib/parser';

describe('MeetingMorph Worker', () => {
  describe('parseTranscript', () => {
    it('should be defined', () => {
      expect(parseTranscript).toBeDefined();
    });

    it('should parse action items from meeting notes', () => {
      const transcript = [
        'Sprint planning notes - March 2026',
        '',
        '- @alice will update the API docs by Friday',
        '- TODO: Fix the auth bug (urgent)',
        '- Bob needs to review the PR before EOD',
        '- Nice discussion about the roadmap',
        '- Action item: Deploy the staging environment',
      ].join('\n');

      const result = parseTranscript(transcript);

      expect(result.actionItems).toBeDefined();
      expect(result.actionItems.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.parsedAt).toBeDefined();
    });

    it('should detect assignees from @mentions', () => {
      const transcript = '@alice will fix the login page';
      const result = parseTranscript(transcript);

      const aliceItem = result.actionItems.find(item =>
        item.assignee === 'alice'
      );
      expect(aliceItem).toBeDefined();
    });

    it('should detect high priority items', () => {
      const transcript = 'TODO: Fix critical security vulnerability (urgent)';
      const result = parseTranscript(transcript);

      expect(result.actionItems.length).toBeGreaterThan(0);
      const urgentItem = result.actionItems.find(item => item.priority === 'high');
      expect(urgentItem).toBeDefined();
    });

    it('should detect deadlines', () => {
      const transcript = '@bob will submit the report by Friday';
      const result = parseTranscript(transcript);

      const bobItem = result.actionItems.find(item =>
        item.assignee === 'bob'
      );
      expect(bobItem).toBeDefined();
      expect(bobItem?.deadline).toBeTruthy();
    });

    it('should return empty items for non-actionable text', () => {
      const transcript = 'Just a normal conversation about the weather and lunch plans.';
      const result = parseTranscript(transcript);

      expect(result.actionItems.length).toBe(0);
    });

    it('should handle empty input', () => {
      const result = parseTranscript('');

      expect(result.actionItems).toEqual([]);
      expect(result.summary).toBeDefined();
    });
  });

  describe('formatForLinear', () => {
    it('should format action items for Linear API', () => {
      const items = [
        { title: 'Fix bug', assignee: 'alice', priority: 'high' as const, deadline: 'Friday', description: 'Fix the bug' },
      ];
      const result = formatForLinear(items);

      expect(result).toHaveProperty('issues');
      const issues = (result as { issues: Array<{ priority: number }> }).issues;
      expect(issues[0].priority).toBe(1); // high = 1 in Linear
    });
  });

  describe('formatForJira', () => {
    it('should format action items for Jira API', () => {
      const items = [
        { title: 'Fix bug', assignee: 'alice', priority: 'high' as const, deadline: 'Friday', description: 'Fix the bug' },
      ];
      const result = formatForJira(items);

      expect(result).toHaveProperty('issues');
      const issues = (result as { issues: Array<{ priority: { name: string } }> }).issues;
      expect(issues[0].priority.name).toBe('High');
    });
  });
});
