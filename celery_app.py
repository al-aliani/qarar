from celery import Celery

# Setup Celery with Redis broker (Fallback to memory if not installed)
# broker_url can be replaced with your Redis URL (e.g. redis://localhost:6379/0)
# We use amqp for rabbitmq, but redis is standard for SaaS.

app = Celery(
    'feasibility_tasks',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0',
    include=['tasks']
)

# Optional configuration
app.conf.update(
    result_expires=3600,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

if __name__ == '__main__':
    app.start()
