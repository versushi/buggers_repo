#include <msp430.h> 
#include  <stdint.h>


// Declare function
void config_ACLK_to_32KHz_crystal();

// Flashing the LED with Timer_A, continuous mode, via polling
#define redLED BIT0 	// Red LED at P1.0
#define greenLED BIT7 	// Green LED at P9.7
#define BUT1 BIT1		// Button S1 at P1.1
#define BUT2 BIT2		// Button S2 at P1.2
uint16_t targetTime;

void main(void) {
// Stop the Watchdog timer & Unlock the GPIO pins
	WDTCTL = WDTPW | WDTHOLD;
	PM5CTL0 &= ~LOCKLPM5;
// Configure the LEDs as output
	P1DIR |= redLED;		// Direct pin 1 as output
	P9DIR |= greenLED; 		// Direct pin 9 as output
	P1OUT &= ~redLED; 		// Turn LED off
	P9OUT &= ~greenLED; 	// Turn LED off
// Configure buttons 
	P1DIR &= ~(BUT1 | BUT2);		// Direct pin as input
	P1REN |= BUT1 | BUT2;    	// Enable the built-in resistor
	P1OUT |= BUT1 | BUT2; 		// Set resistor as pull-up

// Configure ACLK to the 32 KHz crystal (function call)
	config_ACLK_to_32KHz_crystal();
// Helper for timer configuration
// Timer_A0
// │
// ├── TA0CTL       Overall timer configuration
// ├── TA0R         Current counter value
// │
// └── Channel 0
//     ├── TA0CCR0  Target compare value
//     └── TA0CCTL0 Channel configuration and CCIFG
// Configure Timer_A
// Infinite loop
	for(;;) {
// Use ACLK, divide by 1, IN STOP MODE (MC_0) TO SAVE POWER, clear TAR
		TA0CTL =  TASSEL_1| ID_0 | MC_0 | TACLR;
// Ensure flag of the main clock is cleared at the start
		TA0CTL &= ~TAIFG;
// Wait for the button to be pressed then begin the timer in Continuous mode
		while((P1IN & BUT1) != 0){}
		TA0CTL =  TASSEL_1 | ID_0 | MC_2 | TACLR;

		// Wait in this empty loop until the button is released, once released turn led on
		while((P1IN & BUT1) == 0){
			// Case if timer triggers the limit
			if ((TA0CTL & TAIFG) != 0){
				P1OUT &= ~redLED;
				P9OUT |= greenLED;
			}
		}

// Stop timer and set the target
		TA0CTL &= MC_0;
		targetTime = TA0R;

//Waits for button 2 to turn off GreenLED
		if (P9OUT & greenLED != 0){
			while((P1IN & BUT2) != 0){}
			while ((P1IN & BUT2) == 0) {}
			P9OUT &= ~greenLED;
		}

// Case if timer is withint limit
		else if( (TA0CTL & TAIFG) == 0){
			// Set the current count to the targeted count
			TA0CCR0 = targetTime;
			// Clear the flag of the secondary timer
			TA0CCTL0 &= ~CCIFG;
			TA0CTL = TASSEL_1 | ID_0 | MC_1 | TACLR;
			P1OUT |= redLED;
			// Wait until the counter reaches the saved count
        	while ((TA0CCTL0 & CCIFG) == 0) {}
        	TA0CTL|= MC_0;
			P1OUT &= ~redLED;
		}
	}
}

// Configures ACLK to 32 KHz crystal
void config_ACLK_to_32KHz_crystal() {
// By default, ACLK runs on LFMODCLK at 5MHz/128 = 39 KHz
// Reroute pins to LFXIN/LFXOUT functionality
	PJSEL1 &= ~BIT4;
	PJSEL0 |= BIT4;
	// Wait until the oscillator fault flags remain cleared
	CSCTL0 = CSKEY; // Unlock CS registers
	do {
		CSCTL5 &= ~LFXTOFFG; // Local fault flag
		SFRIFG1 &= ~OFIFG; // Global fault flag
	}
	while((CSCTL5 & LFXTOFFG) != 0);
		CSCTL0_H = 0; // Lock CS registers
	return;
}