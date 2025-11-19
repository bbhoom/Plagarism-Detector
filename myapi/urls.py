from django.urls import path
from . import views

urlpatterns = [
    path('hello-world/', views.hello_world, name='hello_world'),
    path('upload-pdf/', views.upload_pdf, name='upload_pdf'),
    path('detect-ai/', views.detect_ai, name='detect_ai'),
    path('combined-check/', views.combined_check, name='combined_check'),
]
