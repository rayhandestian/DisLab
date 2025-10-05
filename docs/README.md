# Discord Lab - Recurring Schedules Documentation

## 📋 Overview

This documentation covers the implementation of recurring schedules for Discord Lab, addressing two critical issues:

1. **"Failed to save schedule" error** - Mismatch between [`ScheduleForm.tsx`](../components/ScheduleForm.tsx) and [`scheduleService.ts`](../lib/scheduleService.ts)
2. **One-time execution only** - No recurring schedule functionality

## 🎯 Solution Summary

The implementation adds:
- ✅ **Recurring Schedules**: Daily, weekly, monthly, and custom cron patterns
- ✅ **Natural Language Input**: "every Monday at 9 AM" → automatic parsing
- ✅ **Backend Execution**: Supabase Edge Functions + pg_cron
- ✅ **Schedule Management**: Edit, delete, track execution history
- ✅ **File Attachments**: Full support for webhook file uploads

## 📚 Documentation Structure

### 1. [Quick Start Guide](./QUICK_START.md) ⚡
**Start here!** Step-by-step implementation guide with time estimates.

**Contents**:
- Implementation order (9 steps)
- Quick fix for immediate issue
- Architecture diagram
- File structure overview
- Estimated time: 8-11 hours

**Best for**: Getting started quickly, understanding the big picture

---

### 2. [System Architecture](./SCHEDULE_SYSTEM_ARCHITECTURE.md) 🏗️
Comprehensive architectural design and planning document.

**Contents**:
- Current issues analysis
- Proposed solution architecture
- Database schema design
- Recurrence pattern system
- TypeScript type system
- UI component architecture
- Edge Function design
- Implementation phases
- Security & performance considerations

**Best for**: Understanding the complete system design, making architectural decisions

---

### 3. [Database Migration](./DATABASE_MIGRATION.md) 🗄️
Complete database migration guide with SQL scripts.

**Contents**:
- Migration SQL (copy-paste ready)
- Rollback procedures
- Verification queries
- Storage bucket setup
- Troubleshooting guide
- Performance optimization

**Best for**: Database administrators, running migrations safely

---

### 4. [Implementation Guide](./IMPLEMENTATION_GUIDE.md) 💻
Detailed code implementation instructions.

**Contents**:
- TypeScript types & interfaces (complete code)
- Cron parser utility (complete code)
- Schedule service updates (complete code)
- UI components (complete code)
- Edge Function (complete code)
- Testing guide

**Best for**: Developers implementing the features, code reference

---

### 5. [Testing & Deployment](./TESTING_AND_DEPLOYMENT.md) 🚀
Comprehensive testing and deployment procedures.

**Contents**:
- Testing strategy (3 phases)
- Manual testing checklist (50+ test cases)
- Deployment steps (5 steps)
- Monitoring & troubleshooting
- Rollback procedures
- Performance optimization

**Best for**: QA engineers, DevOps, production deployment

---

## 🚀 Quick Implementation Path

### For Immediate Fix (30 minutes)

If you just need to fix the "Failed to save schedule" error:

1. Read: [Quick Start - Quick Fix Section](./QUICK_START.md#quick-fix-for-immediate-issue)
2. Update [`ScheduleForm.tsx`](../components/ScheduleForm.tsx) to use [`scheduleService.ts`](../lib/scheduleService.ts)
3. Test schedule creation

### For Full Implementation (8-11 hours)

Follow this order:

1. **Read** → [Quick Start Guide](./QUICK_START.md) (15 min)
2. **Plan** → [System Architecture](./SCHEDULE_SYSTEM_ARCHITECTURE.md) (30 min)
3. **Database** → [Database Migration](./DATABASE_MIGRATION.md) (15 min)
4. **Code** → [Implementation Guide](./IMPLEMENTATION_GUIDE.md) (4-6 hours)
5. **Test** → [Testing & Deployment](./TESTING_AND_DEPLOYMENT.md) (2-3 hours)
6. **Deploy** → [Testing & Deployment - Deployment Steps](./TESTING_AND_DEPLOYMENT.md#deployment-steps) (30 min)

## 🎨 Feature Highlights

### Natural Language Scheduling

Users can type schedules in plain English:

```
"every Monday at 9 AM"           → Weekly on Mondays at 09:00
"daily at 2:30 PM"               → Daily at 14:30
"every weekday at 8 AM"          → Mon-Fri at 08:00
"monthly on the 1st at noon"     → 1st of each month at 12:00
"every 6 hours"                  → Custom cron: 0 */6 * * *
```

### Recurrence Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **Once** | Single execution | Tomorrow at 3 PM |
| **Daily** | Every day at specified time | Every day at 9 AM |
| **Weekly** | Specific days of week | Mon, Wed, Fri at 2 PM |
| **Monthly** | Specific day of month | 15th of each month at noon |
| **Custom** | Full cron expression | `0 9 * * 1-5` (weekdays at 9 AM) |

### Execution Tracking

- `execution_count`: Number of times executed
- `last_executed_at`: Last execution timestamp
- `next_execution_at`: Next scheduled execution
- `max_executions`: Optional limit (e.g., run 10 times then stop)

## 🔧 Technical Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage)
- **Scheduling**: pg_cron (runs every minute)
- **Authentication**: Supabase Auth with Discord OAuth

## 📊 Database Schema

Key tables and columns:

```sql
schedules (
  -- Existing
  id, user_id, name, webhook_url, message_data,
  schedule_time, is_active, created_at, updated_at,
  
  -- New for recurring schedules
  builder_state JSONB,           -- Rich webhook builder state
  files JSONB,                   -- File attachment metadata
  is_recurring BOOLEAN,          -- Is this recurring?
  recurrence_pattern TEXT,       -- once/daily/weekly/monthly/custom
  recurrence_config JSONB,       -- Pattern-specific config
  cron_expression TEXT,          -- For custom patterns
  last_executed_at TIMESTAMP,    -- Last execution time
  next_execution_at TIMESTAMP,   -- Next execution time
  execution_count INTEGER,       -- Number of executions
  max_executions INTEGER         -- Optional execution limit
)
```

## 🔐 Security Considerations

1. **Row Level Security (RLS)**: Users can only access their own schedules
2. **Service Role Key**: Kept secure in Edge Function environment
3. **Webhook URL Validation**: Validate Discord webhook URLs
4. **File Storage**: Path-based security (`users/[user_id]/...`)
5. **Rate Limiting**: Prevent abuse of scheduling system

## 📈 Performance Metrics

Expected performance:
- **Schedule Creation**: < 500ms
- **Schedule Execution**: < 2s per webhook
- **Cron Job**: Processes 100 schedules per minute
- **Database Queries**: < 100ms with proper indexing

## 🐛 Common Issues & Solutions

### Issue: "Failed to save schedule"
**Cause**: Using old `ScheduleForm.tsx` that doesn't match `scheduleService.ts` API  
**Solution**: Update form to use `createSchedule()` from service layer  
**Reference**: [Quick Start - Quick Fix](./QUICK_START.md#quick-fix-for-immediate-issue)

### Issue: Schedules not executing
**Cause**: Cron job not configured or Edge Function not deployed  
**Solution**: Follow deployment steps, verify cron job is enabled  
**Reference**: [Testing & Deployment - Troubleshooting](./TESTING_AND_DEPLOYMENT.md#common-issues--solutions)

### Issue: Wrong execution time
**Cause**: Timezone mismatch or incorrect recurrence calculation  
**Solution**: Store times in UTC, verify recurrence_config  
**Reference**: [Testing & Deployment - Troubleshooting](./TESTING_AND_DEPLOYMENT.md#issue-incorrect-next-execution-time)

## 📞 Support

For issues or questions:
1. Check [Testing & Deployment - Troubleshooting](./TESTING_AND_DEPLOYMENT.md#monitoring--troubleshooting)
2. Review [System Architecture](./SCHEDULE_SYSTEM_ARCHITECTURE.md) for design decisions
3. Consult [Implementation Guide](./IMPLEMENTATION_GUIDE.md) for code examples

## 🎯 Success Criteria

Implementation is complete when:
- ✅ Database migration successful
- ✅ Edge Function deployed and responding
- ✅ Cron job running every minute
- ✅ One-time schedules executing correctly
- ✅ Recurring schedules executing and updating
- ✅ Natural language parsing working
- ✅ File attachments supported
- ✅ All tests passing
- ✅ No errors in production logs

## 📝 Version History

- **v1.0** (2025-10-05): Initial recurring schedules implementation
  - Added recurring schedule support
  - Fixed "Failed to save schedule" error
  - Added natural language parsing
  - Implemented Edge Function execution
  - Added comprehensive documentation

## 🗺️ Roadmap

Future enhancements:
- [ ] Schedule templates
- [ ] Bulk schedule operations
- [ ] Email notifications for failures
- [ ] Schedule execution history viewer
- [ ] Advanced cron expression builder UI
- [ ] Schedule sharing between users
- [ ] Webhook response logging

## 📄 License

This documentation is part of the Discord Lab project.

---

**Ready to get started?** → [Quick Start Guide](./QUICK_START.md)