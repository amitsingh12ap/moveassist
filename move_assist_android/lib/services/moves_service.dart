import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/move.dart';

class MovesService {
  static String get baseUrl => ApiConfig.baseUrl;

  static Future<List<Move>> getMoves(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/moves'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body) as List;
      return data.map((m) => Move.fromJson(m as Map<String, dynamic>)).toList();
    }
    final err = jsonDecode(response.body) as Map<String, dynamic>;
    throw Exception(err['error'] ?? 'Failed to load moves');
  }

  static Future<Map<String, dynamic>> createMove({
    required String token,
    required Map<String, dynamic> body,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/moves'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(body),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 201 || response.statusCode == 200) return data;
    throw Exception(data['error'] ?? 'Failed to create move');
  }
}