# MoveAssist Flutter App Structure

```
lib/
├── main.dart
├── app/
│   ├── app.dart                  # MaterialApp + router setup
│   └── router.dart               # GoRouter config
├── core/
│   ├── api/
│   │   ├── api_client.dart       # Dio instance + interceptors
│   │   └── endpoints.dart        # All API endpoint constants
│   ├── auth/
│   │   ├── auth_provider.dart    # Riverpod auth state
│   │   └── token_storage.dart    # Secure token storage
│   └── models/
│       ├── move.dart
│       ├── box.dart
│       ├── box_scan.dart
│       ├── furniture_item.dart
│       └── furniture_photo.dart
├── features/
│   ├── auth/
│   │   ├── login_screen.dart
│   │   └── register_screen.dart
│   ├── moves/
│   │   ├── moves_list_screen.dart
│   │   ├── move_detail_screen.dart
│   │   └── create_move_screen.dart
│   ├── boxes/
│   │   ├── box_list_screen.dart
│   │   ├── box_detail_screen.dart
│   │   ├── qr_scanner_screen.dart    # Mobile scanner
│   │   └── qr_display_screen.dart    # Show QR to scan
│   ├── furniture/
│   │   ├── furniture_list_screen.dart
│   │   ├── add_furniture_screen.dart
│   │   └── furniture_photo_screen.dart
│   └── reports/
│       └── report_screen.dart        # Generate + view PDF
└── shared/
    ├── widgets/
    │   ├── status_badge.dart
    │   ├── photo_grid.dart
    │   └── loading_button.dart
    └── theme/
        └── app_theme.dart
```
