#include <msp430fr6989.h>
#define redLED BIT0 // Red LED at P1.0
#define greenLED BIT7 // Green LED at P9.7
#define BUT1 BIT1 // Button S1 at Port 1.1
#define BUT2 BIT2 // Button S2 at Port 1.2

void main(void) {
	WDTCTL = WDTPW | WDTHOLD; // Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins
	P1DIR |= redLED; 		// Direct pin as output
	P9DIR |= greenLED; 		// Direct pin as output
	P1OUT &= ~redLED; 		// Turn LED Off
	P9OUT &= ~greenLED; 	// Turn LED Off

	// Configure the buttons for interrupts
	P1DIR &= ~(BUT1|BUT2); // 0: input
	P1REN |= (BUT1|BUT2);  // 1: enable built-in resistors
	P1OUT |= (BUT1|BUT2);  // 1: built-in resistor is pulled up to Vcc
	P1IES |= (BUT1|BUT2);  // 1: interrupt on falling edge (0 for rising edge)
	P1IFG &= ~(BUT1|BUT2); // 0: clear the interrupt flags
	P1IE  |= (BUT1|BUT2);  // 1: enable the interrupts

	// Configure ACLK to the 32 KHz crystal
	config_ACLK_to_32KHz_crystal();

	// Timer_A: ACLK, div by 1, Continuous mode, clear TAR
	TA0CTL = TASSEL_1 | ID_0 | MC_2 | TACLR ;
	// Enable the global interrupt bit (call an intrinsic function)
	_enable_interrupts();
	// For part 4 of lab 4, enabling low power mode, I would comment out the above enable_interrupt line
	// and uncomment the below line 
	// _low_power_mode_4();
	for(;;) {}
}

#pragma vector = PORT1_VECTOR // Write the vector name
__interrupt void Port1_ISR() {
	// Detect button 1 interrupt flag
	if ((P1IFG & BUT1) != 0){
		// Button 1 action
		P1OUT ^= redLED;
		P1IFG &= ~BUT1;
	}
	// Detect button 2 interrupt flag
	if ((P1IFG & BUT2) != 0) {
		// Button 2 action
		P9OUT ^= greenLED;
		P1IFG &= ~BUT2;
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
