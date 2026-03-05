import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class SessionService {
  static const _kToken = 'auth_token';
  static const _kUser = 'auth_user';

  /// Persists token + user map to SharedPreferences.
  static Future<void> save({
    required String token,
    required Map<String, dynamic> user,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.setString(_kToken, token),
      prefs.setString(_kUser, jsonEncode(user)),
    ]);
  }

  /// Returns saved session or null if none exists.
  static Future<({String token, Map<String, dynamic> user})?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_kToken);
    final userJson = prefs.getString(_kUser);
    if (token == null || userJson == null) return null;
    try {
      final user = jsonDecode(userJson) as Map<String, dynamic>;
      return (token: token, user: user);
    } catch (_) {
      return null;
    }
  }

  /// Clears all saved session data.
  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.remove(_kToken),
      prefs.remove(_kUser),
    ]);
  }
}
