
import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RefereeService, FightResult } from './services/referee.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent {
  private refereeService = inject(RefereeService);

  // Inputs
  leftTerm = signal('');
  rightTerm = signal('');

  // State
  isFighting = signal(false);
  hasFought = signal(false);
  error = signal<string | null>(null);

  // Result Data
  result = signal<FightResult | null>(null);

  // Computed visual metrics
  leftBarHeight = computed(() => {
    const res = this.result();
    if (!res) return 0;
    const max = Math.max(res.leftScore, res.rightScore);
    // scale to percentage, min 10%
    return Math.max(10, (res.leftScore / max) * 100);
  });

  rightBarHeight = computed(() => {
    const res = this.result();
    if (!res) return 0;
    const max = Math.max(res.leftScore, res.rightScore);
    return Math.max(10, (res.rightScore / max) * 100);
  });

  async startFight() {
    const t1 = this.leftTerm().trim();
    const t2 = this.rightTerm().trim();

    if (!t1 || !t2) {
      this.error.set('Please enter two challengers!');
      return;
    }

    this.error.set(null);
    this.isFighting.set(true);
    this.hasFought.set(false);
    this.result.set(null);

    // Artificial delay for dramatic effect (and to show animation)
    // plus the actual API call time.
    try {
      // Start the API call
      const fightPromise = this.refereeService.judgeTerms(t1, t2);
      
      // Wait at least 1.5 seconds for the "fight" animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const fightResult = await fightPromise;
      
      this.result.set(fightResult);
      this.hasFought.set(true);
    } catch (e) {
      this.error.set('The fight was interrupted by a technical foul. Please try again.');
    } finally {
      this.isFighting.set(false);
    }
  }

  reset() {
    this.hasFought.set(false);
    this.leftTerm.set('');
    this.rightTerm.set('');
    this.result.set(null);
  }
}
