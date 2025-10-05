-- Unschedule all existing cron jobs and create new one with auth
select cron.unschedule(jobname) from cron.job;

select cron.schedule('execute-schedules', '* * * * *', 'select net.http_post(
  url:=''https://wobskauxkihopgwktptq.supabase.co/functions/v1/execute-schedules'',
  headers:=jsonb_build_object(''Authorization'', ''Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYnNrYXV4a2lob3Bnd2t0cHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODQxMjQsImV4cCI6MjA3NTE2MDEyNH0.HugaQxl5z24waoScWkd5VUXvI-fSWWPB_ImBK8_iRs0''),
  timeout_milliseconds:=5000
);');