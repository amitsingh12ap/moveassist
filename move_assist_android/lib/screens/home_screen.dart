import 'package:flutter/material.dart';
import '../services/session_service.dart';
import 'tabs/moves_tab.dart';
import 'tabs/profile_tab.dart';
import 'auth_screen.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final String token;

  const HomeScreen({super.key, required this.user, required this.token});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  Future<void> _onLogout() async {
    await SessionService.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      MovesTab(token: widget.token),
      const _ScanPlaceholder(),
      ProfileTab(user: widget.user, onLogout: _onLogout),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFf6f7f8),
      // Top bar
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: const Color(0xFFe2e8f0),
        titleSpacing: 16,
        title: RichText(
          text: const TextSpan(
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0f1729),
              letterSpacing: -0.3,
            ),
            children: [
              TextSpan(text: 'Move'),
              TextSpan(
                text: 'Assist',
                style: TextStyle(color: Color(0xFF64748b), fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: _Avatar(name: (widget.user['name'] as String?) ?? 'U'),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: Color(0xFFe2e8f0)),
        ),
      ),
      body: IndexedStack(index: _currentIndex, children: tabs),
      // Bottom nav
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFe2e8f0))),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 58,
            child: Row(
              children: [
                _NavBtn(icon: '🏠', label: 'Moves',   index: 0, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
                _NavBtn(icon: '📷', label: 'Scan',    index: 1, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
                _NavBtn(icon: '👤', label: 'Profile', index: 2, current: _currentIndex, onTap: (i) => setState(() => _currentIndex = i)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Avatar ───────────────────────────────────────────────────────
class _Avatar extends StatelessWidget {
  final String name;
  const _Avatar({required this.name});

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isNotEmpty
        ? name.trim().split(' ').map((w) => w[0].toUpperCase()).take(2).join()
        : '?';
    return Container(
      width: 32,
      height: 32,
      decoration: const BoxDecoration(color: Color(0xFF2563eb), shape: BoxShape.circle),
      child: Center(
        child: Text(initials,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
      ),
    );
  }
}

// ── Nav button ───────────────────────────────────────────────────
class _NavBtn extends StatelessWidget {
  final String icon;
  final String label;
  final int index;
  final int current;
  final void Function(int) onTap;

  const _NavBtn({
    required this.icon,
    required this.label,
    required this.index,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(index),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
                color: active ? const Color(0xFF2563eb) : const Color(0xFF64748b),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Scan placeholder ─────────────────────────────────────────────
class _ScanPlaceholder extends StatelessWidget {
  const _ScanPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('📷', style: TextStyle(fontSize: 48)),
          SizedBox(height: 12),
          Text('Scan QR', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
          SizedBox(height: 4),
          Text('Coming soon', style: TextStyle(fontSize: 13, color: Color(0xFF64748b))),
        ],
      ),
    );
  }
}