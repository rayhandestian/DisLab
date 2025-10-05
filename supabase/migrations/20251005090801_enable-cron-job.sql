-- Enable the cron job
select cron.alter_job(jobid, active => true) from cron.job where jobname = 'execute-schedules';