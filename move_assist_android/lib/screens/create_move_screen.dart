import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../services/moves_service.dart';

class CreateMoveScreen extends StatefulWidget {
  final String token;
  final VoidCallback onMoveCreated;

  const CreateMoveScreen({
    super.key,
    required this.token,
    required this.onMoveCreated,
  });

  @override
  State<CreateMoveScreen> createState() => _CreateMoveScreenState();
}

class _CreateMoveScreenState extends State<CreateMoveScreen> {
  int _step = 1;

  // Step 1
  final _titleCtrl = TextEditingController();
  final _fromCtrl = TextEditingController();
  final _toCtrl = TextEditingController();
  DateTime _moveDate = DateTime.now().add(const Duration(days: 1));

  List<_AddrSuggestion> _fromSuggestions = [];
  List<_AddrSuggestion> _toSuggestions = [];
  Timer? _fromTimer, _toTimer;

  String _fromCity = '', _toCity = '';
  double? _fromLat, _fromLng, _toLat, _toLng;

  // Step 2
  String? _selectedBHK;
  int _floorFrom = 0, _floorTo = 0;
  bool _hasLiftFrom = false, _hasLiftTo = false, _hasFragile = false;

  Map<String, dynamic>? _estimate;
  bool _loadingEstimate = false;
  bool _loading = false;

  static const _kBlue = Color(0xFF2563eb);
  static const _kText = Color(0xFF0f1729);
  static const _kSub = Color(0xFF64748b);
  static const _kBorder = Color(0xFFe2e8f0);
  static const _kBg = Color(0xFFf6f7f8);
  static const _kCard2 = Color(0xFFf8fafc);

  @override
  void dispose() {
    _titleCtrl.dispose();
    _fromCtrl.dispose();
    _toCtrl.dispose();
    _fromTimer?.cancel();
    _toTimer?.cancel();
    super.dispose();
  }

  // ── Address autocomplete ─────────────────────────────────────
  void _onFromChanged(String val) {
    _fromTimer?.cancel();
    if (val.length < 3) {
      setState(() => _fromSuggestions = []);
      return;
    }
    _fromTimer = Timer(const Duration(milliseconds: 400), () => _fetchSuggestions(val, true));
  }

  void _onToChanged(String val) {
    _toTimer?.cancel();
    if (val.length < 3) {
      setState(() => _toSuggestions = []);
      return;
    }
    _toTimer = Timer(const Duration(milliseconds: 400), () => _fetchSuggestions(val, false));
  }

  Future<void> _fetchSuggestions(String query, bool isFrom) async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/search'
        '?q=${Uri.encodeComponent(query)}'
        '&format=json&addressdetails=1&limit=5&countrycodes=in',
      );
      final resp = await http.get(url, headers: {
        'User-Agent': 'MoveAssist/1.0',
        'Accept-Language': 'en',
      });
      if (!mounted) return;
      final results = jsonDecode(resp.body) as List;
      final suggestions = results.map<_AddrSuggestion>((item) {
        final addr = (item['address'] as Map?)?.cast<String, dynamic>() ?? {};
        final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'] ?? '';
        final parts = (item['display_name'] as String).split(',');
        final display = parts.take(3).join(',').trim();
        return _AddrSuggestion(
          display: display,
          city: city.toString(),
          lat: double.tryParse(item['lat']?.toString() ?? ''),
          lng: double.tryParse(item['lon']?.toString() ?? ''),
        );
      }).toList();
      setState(() {
        if (isFrom) { _fromSuggestions = suggestions; }
        else { _toSuggestions = suggestions; }
      });
    } catch (_) {}
  }

  void _selectFrom(_AddrSuggestion s) {
    setState(() {
      _fromCtrl.text = s.display;
      _fromCity = s.city;
      _fromLat = s.lat;
      _fromLng = s.lng;
      _fromSuggestions = [];
    });
  }

  void _selectTo(_AddrSuggestion s) {
    setState(() {
      _toCtrl.text = s.display;
      _toCity = s.city;
      _toLat = s.lat;
      _toLng = s.lng;
      _toSuggestions = [];
    });
  }

  // ── Date picker ──────────────────────────────────────────────
  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _moveDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: _kBlue),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _moveDate = picked);
  }

  // ── Step navigation ──────────────────────────────────────────
  void _goToStep2() {
    if (_titleCtrl.text.trim().isEmpty) { _showError('Please enter a move title'); return; }
    if (_fromCtrl.text.trim().isEmpty) { _showError('Please enter a pickup address'); return; }
    if (_toCtrl.text.trim().isEmpty) { _showError('Please enter a delivery address'); return; }
    setState(() => _step = 2);
  }

  // ── Pricing estimate ─────────────────────────────────────────
  Future<void> _fetchEstimate() async {
    if (_selectedBHK == null) return;
    setState(() => _loadingEstimate = true);
    try {
      final resp = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/pricing/estimate'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'bhk_type': _selectedBHK,
          'num_furniture': 0,
          'num_boxes': 0,
          'floor_from': _floorFrom,
          'floor_to': _floorTo,
          'has_lift_from': _hasLiftFrom,
          'has_lift_to': _hasLiftTo,
          'has_fragile': _hasFragile,
        }),
      );
      if (mounted && resp.statusCode == 200) {
        setState(() => _estimate = jsonDecode(resp.body) as Map<String, dynamic>);
      }
    } catch (_) {} finally {
      if (mounted) setState(() => _loadingEstimate = false);
    }
  }

  // ── Create move ──────────────────────────────────────────────
  Future<void> _createMove() async {
    setState(() => _loading = true);
    try {
      await MovesService.createMove(
        token: widget.token,
        body: {
          'title': _titleCtrl.text.trim(),
          'from_address': _fromCtrl.text.trim(),
          'to_address': _toCtrl.text.trim(),
          'move_date': '${_moveDate.year}-${_moveDate.month.toString().padLeft(2, '0')}-${_moveDate.day.toString().padLeft(2, '0')}',
          'from_city': _fromCity,
          'to_city': _toCity,
          if (_fromLat != null) 'from_lat': _fromLat,
          if (_fromLng != null) 'from_lng': _fromLng,
          if (_toLat != null) 'to_lat': _toLat,
          if (_toLng != null) 'to_lng': _toLng,
          'floor_from': _floorFrom,
          'floor_to': _floorTo,
          'has_lift_from': _hasLiftFrom,
          'has_lift_to': _hasLiftTo,
          'bhk_type': _selectedBHK,
        },
      );
      if (!mounted) return;
      widget.onMoveCreated();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Move created! 🎉'),
          backgroundColor: const Color(0xFF22c55e),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _showError(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: const Color(0xFFef4444),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  // ── Build ────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: _kBorder,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _kText),
          onPressed: _step == 2
              ? () => setState(() => _step = 1)
              : () => Navigator.of(context).pop(),
        ),
        title: Text(
          _step == 1 ? 'New Move' : 'Move Details',
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: _kText),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: _kBorder),
        ),
      ),
      body: _step == 1 ? _buildStep1() : _buildStep2(),
    );
  }

  // ── Step 1 ───────────────────────────────────────────────────
  Widget _buildStep1() {
    final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    final dateStr = '${months[_moveDate.month - 1]} ${_moveDate.day}, ${_moveDate.year}';

    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        setState(() { _fromSuggestions = []; _toSuggestions = []; });
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StepBar(step: 1),
            const SizedBox(height: 20),

            // Title
            _Label('MOVE TITLE'),
            _Input(controller: _titleCtrl, hint: 'e.g. Home Shifting — Sector 82'),
            const SizedBox(height: 16),

            // Pickup address
            Row(children: [
              const Text('📍', style: TextStyle(fontSize: 14)),
              const SizedBox(width: 4),
              const Text('PICKUP ADDRESS',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kSub, letterSpacing: 0.5)),
              const Spacer(),
              Text('start typing for suggestions',
                  style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
            ]),
            const SizedBox(height: 6),
            _Input(
              controller: _fromCtrl,
              hint: 'Current address',
              onChanged: _onFromChanged,
            ),
            if (_fromSuggestions.isNotEmpty)
              _SuggestionList(suggestions: _fromSuggestions, onSelect: _selectFrom),
            const SizedBox(height: 16),

            // Delivery address
            Row(children: [
              const Text('🏠', style: TextStyle(fontSize: 14)),
              const SizedBox(width: 4),
              const Text('DELIVERY ADDRESS',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kSub, letterSpacing: 0.5)),
            ]),
            const SizedBox(height: 6),
            _Input(
              controller: _toCtrl,
              hint: 'Destination address',
              onChanged: _onToChanged,
            ),
            if (_toSuggestions.isNotEmpty)
              _SuggestionList(suggestions: _toSuggestions, onSelect: _selectTo),
            const SizedBox(height: 16),

            // Move date
            _Label('MOVE DATE'),
            const SizedBox(height: 6),
            GestureDetector(
              onTap: _pickDate,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: _kCard2,
                  border: Border.all(color: _kBorder),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 16, color: _kSub),
                    const SizedBox(width: 10),
                    Text(dateStr,
                        style: const TextStyle(fontSize: 15, color: _kText, fontWeight: FontWeight.w500)),
                    const Spacer(),
                    const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94a3b8)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),

            _PrimaryBtn(label: 'Next — Add Details →', onTap: _goToStep2),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  // ── Step 2 ───────────────────────────────────────────────────
  Widget _buildStep2() {
    const bhkLabels = ['STUDIO', '1BHK', '2BHK', '3BHK', '4BHK'];
    const bhkValues = ['studio', '1bhk', '2bhk', '3bhk', '4bhk'];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepBar(step: 2),
          const SizedBox(height: 20),

          // Section header
          const Text('PROPERTY DETAILS',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _kSub, letterSpacing: 0.8)),
          const SizedBox(height: 14),

          // BHK grid
          _Label('HOME SIZE'),
          const SizedBox(height: 8),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 2.4,
            children: List.generate(bhkLabels.length, (i) {
              final selected = _selectedBHK == bhkValues[i];
              return GestureDetector(
                onTap: () {
                  setState(() => _selectedBHK = bhkValues[i]);
                  _fetchEstimate();
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  decoration: BoxDecoration(
                    color: selected ? _kBlue : Colors.white,
                    border: Border.all(
                      color: selected ? _kBlue : _kBorder,
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Text(
                      bhkLabels[i],
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: selected ? Colors.white : _kText,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 20),

          // Floor inputs
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Label('PICKUP FLOOR'),
                    const SizedBox(height: 6),
                    _FloorInput(
                      value: _floorFrom,
                      onChanged: (v) { setState(() => _floorFrom = v); _fetchEstimate(); },
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Label('DELIVERY FLOOR'),
                    const SizedBox(height: 6),
                    _FloorInput(
                      value: _floorTo,
                      onChanged: (v) { setState(() => _floorTo = v); _fetchEstimate(); },
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Lift toggles
          Row(
            children: [
              Expanded(
                child: _ToggleRow(
                  label: 'Lift at pickup',
                  value: _hasLiftFrom,
                  onChanged: (v) { setState(() => _hasLiftFrom = v); _fetchEstimate(); },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ToggleRow(
                  label: 'Lift at delivery',
                  value: _hasLiftTo,
                  onChanged: (v) { setState(() => _hasLiftTo = v); _fetchEstimate(); },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Fragile
          _ToggleRow(
            label: 'I have fragile / valuable items',
            value: _hasFragile,
            onChanged: (v) { setState(() => _hasFragile = v); _fetchEstimate(); },
          ),
          const SizedBox(height: 20),

          // Estimate card
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: _selectedBHK != null ? _buildEstimateCard() : const SizedBox.shrink(),
          ),

          const SizedBox(height: 4),

          // Buttons
          Row(
            children: [
              Expanded(
                flex: 1,
                child: OutlinedButton(
                  onPressed: () => setState(() => _step = 1),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: const BorderSide(color: _kBorder),
                    foregroundColor: _kText,
                  ),
                  child: const Text('← Back',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: _PrimaryBtn(
                  label: 'Create Move 🎉',
                  onTap: _loading ? null : _createMove,
                  loading: _loading,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildEstimateCard() {
    final b = _estimate?['breakdown'] as Map<String, dynamic>?;
    final display = _estimate?['display'] as String?;

    return Container(
      key: const ValueKey('estimate'),
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFeff6ff), Color(0xFFf5f3ff)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFFdbeafe)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ESTIMATED COST',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _kSub, letterSpacing: 0.5)),
          const SizedBox(height: 10),
          if (_loadingEstimate)
            const SizedBox(
              height: 24,
              width: 24,
              child: CircularProgressIndicator(color: _kBlue, strokeWidth: 2),
            )
          else if (display != null) ...[
            Text(display,
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: _kBlue, height: 1)),
            if (b != null) ...[
              const SizedBox(height: 6),
              Text(_breakdownText(b),
                  style: const TextStyle(fontSize: 12, color: _kSub, height: 1.5)),
            ],
            const SizedBox(height: 6),
            const Text('*Estimate only. Final price confirmed after agent assessment.',
                style: TextStyle(fontSize: 10, color: Color(0xFF94a3b8))),
          ] else
            const Text('Select BHK to see estimate',
                style: TextStyle(fontSize: 13, color: _kSub)),
        ],
      ),
    );
  }

  String _breakdownText(Map<String, dynamic> b) {
    final parts = <String>[];
    final base = (b['base'] as num?)?.toInt() ?? 0;
    parts.add('Base (${_selectedBHK?.toUpperCase()}): ₹${_inr(base)}');
    final ff = (b['floorFrom'] as num?)?.toInt() ?? 0;
    if (ff > 0) parts.add('Floor pickup: ₹${_inr(ff)}');
    final ft = (b['floorTo'] as num?)?.toInt() ?? 0;
    if (ft > 0) parts.add('Floor delivery: ₹${_inr(ft)}');
    final fr = (b['fragile'] as num?)?.toInt() ?? 0;
    if (fr > 0) parts.add('Fragile: ₹${_inr(fr)}');
    final tx = (b['tax'] as num?)?.toInt() ?? 0;
    parts.add('GST 18%: ₹${_inr(tx)}');
    return parts.join(' · ');
  }

  String _inr(int n) {
    if (n < 1000) return n.toString();
    final s = n.toString();
    final buf = StringBuffer();
    final rev = s.split('').reversed.toList();
    for (int i = 0; i < rev.length; i++) {
      if (i == 3 || (i > 3 && (i - 3) % 2 == 0)) buf.write(',');
      buf.write(rev[i]);
    }
    return buf.toString().split('').reversed.join();
  }
}

// ── Small widget helpers ─────────────────────────────────────────

class _StepBar extends StatelessWidget {
  final int step;
  const _StepBar({required this.step});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _dot(1, step),
        _line(step > 1),
        _dot(2, step),
        const Spacer(),
        Text('Step $step of 2',
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748b), fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _dot(int n, int current) {
    final active = n <= current;
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: active ? const Color(0xFF2563eb) : const Color(0xFFe2e8f0),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text('$n',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: active ? Colors.white : const Color(0xFF94a3b8),
            )),
      ),
    );
  }

  Widget _line(bool active) {
    return Container(
      width: 24,
      height: 2,
      color: active ? const Color(0xFF2563eb) : const Color(0xFFe2e8f0),
      margin: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF64748b),
            letterSpacing: 0.5));
  }
}

class _Input extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final void Function(String)? onChanged;

  const _Input({required this.controller, required this.hint, this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: const TextStyle(fontSize: 15, color: Color(0xFF0f1729)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF94a3b8), fontSize: 15),
        filled: true,
        fillColor: const Color(0xFFf8fafc),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF2563eb), width: 1.5),
        ),
      ),
    );
  }
}

class _SuggestionList extends StatelessWidget {
  final List<_AddrSuggestion> suggestions;
  final void Function(_AddrSuggestion) onSelect;

  const _SuggestionList({required this.suggestions, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Column(
          children: suggestions.map((s) {
            final isLast = s == suggestions.last;
            return Column(
              children: [
                InkWell(
                  onTap: () => onSelect(s),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: Color(0xFF94a3b8)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(s.display,
                              style: const TextStyle(fontSize: 13, color: Color(0xFF0f1729))),
                        ),
                      ],
                    ),
                  ),
                ),
                if (!isLast)
                  const Divider(height: 1, color: Color(0xFFf1f5f9), indent: 40),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _FloorInput extends StatelessWidget {
  final int value;
  final void Function(int) onChanged;

  const _FloorInput({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFf8fafc),
        border: Border.all(color: const Color(0xFFe2e8f0)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          _btn(Icons.remove, () => onChanged((value - 1).clamp(0, 50))),
          Expanded(
            child: Center(
              child: Text(
                value == 0 ? 'Ground' : 'Floor $value',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0f1729)),
              ),
            ),
          ),
          _btn(Icons.add, () => onChanged((value + 1).clamp(0, 50))),
        ],
      ),
    );
  }

  Widget _btn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 46,
        color: Colors.transparent,
        child: Icon(icon, size: 18, color: const Color(0xFF64748b)),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final bool value;
  final void Function(bool) onChanged;

  const _ToggleRow({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: value ? const Color(0xFFeff6ff) : Colors.white,
          border: Border.all(color: value ? const Color(0xFF2563eb) : const Color(0xFFe2e8f0)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: value ? const Color(0xFF2563eb) : const Color(0xFF0f1729))),
            ),
            const SizedBox(width: 6),
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: value ? const Color(0xFF2563eb) : Colors.white,
                border: Border.all(color: value ? const Color(0xFF2563eb) : const Color(0xFFe2e8f0), width: 1.5),
                borderRadius: BorderRadius.circular(5),
              ),
              child: value
                  ? const Icon(Icons.check, size: 13, color: Colors.white)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _PrimaryBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool loading;

  const _PrimaryBtn({required this.label, required this.onTap, this.loading = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF2563eb),
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFF2563eb).withOpacity(0.4),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 0,
        ),
        child: loading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : Text(label,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
      ),
    );
  }
}

class _AddrSuggestion {
  final String display;
  final String city;
  final double? lat;
  final double? lng;

  const _AddrSuggestion({
    required this.display,
    required this.city,
    this.lat,
    this.lng,
  });
}
